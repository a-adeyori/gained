import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookedEmail, confirmHappenedEmail, familyEmail, quizEmail, settledEmail, topicsReadyEmail } from '../lib/emails';

const startAt = new Date('2026-10-22T21:00:00Z');
const people = { subject: 'Chemistry', studentName: 'Ada Lovelace', tutorName: 'Maya Okafor' };

test('booking emails tell each person what matters to them', () => {
  const payer = bookedEmail({ ...people, to: 'payer', startAt, priceCents: 6000, link: 'L' });
  assert.match(payer.text, /\$60\.00 is held in PayPal, not charged/);
  const tutor = bookedEmail({ ...people, to: 'tutor', startAt, priceCents: 6000, link: 'L' });
  assert.equal(tutor.subject, 'New booking: Chemistry with Ada Lovelace');
  const student = bookedEmail({ ...people, to: 'student', startAt, priceCents: 6000, link: 'L' });
  assert.match(student.text, /^Hi Ada,/);
  assert.match(student.text, /warm-up quiz/);
});

test('each quiz email carries its link, and the check-in says when it closes', () => {
  for (const kind of ['baseline', 'post', 'retention'] as const) {
    const mail = quizEmail({ ...people, kind, link: 'https://x/quiz/1?t=abc', closesAt: null });
    assert.match(mail.text, /https:\/\/x\/quiz\/1\?t=abc/);
  }
  assert.equal(quizEmail({ ...people, kind: 'baseline', link: 'L', closesAt: null }).subject, 'Warm-up quiz for Chemistry');
  assert.match(quizEmail({ ...people, kind: 'retention', link: 'L', closesAt: startAt }).text, /open until/);
});

test('the settled email adds up for the parent and shows the bonus to the tutor', () => {
  const common = { ...people, baseCents: 4800, bonusCents: 555, returnedCents: 645, link: 'L' };
  const payer = settledEmail({ ...common, to: 'payer' });
  assert.match(payer.text, /Base to the tutor: \$48\.00/);
  assert.match(payer.text, /Back to you: \$6\.45/);
  assert.match(settledEmail({ ...common, to: 'tutor' }).text, /Learning bonus: \$5\.55/);
});

test('tutor and parent prompts link to the right place', () => {
  assert.match(topicsReadyEmail({ tutorName: 'Maya Okafor', studentName: 'Ada', subject: 'Chemistry', link: 'TOPICS' }).text, /TOPICS/);
  assert.match(confirmHappenedEmail({ tutorName: 'Maya Okafor', subject: 'Chemistry', link: 'CONFIRM' }).text, /80% base[\s\S]*CONFIRM/);
});

test('family emails name who made the link', () => {
  for (const kind of ['parent-added-you', 'student-added-you', 'account-created', 'invited', 'parent-joined'] as const) {
    const mail = familyEmail({ kind, toName: 'Ada Lovelace', byName: 'Grace Hopper', link: 'LINK' });
    assert.match(mail.subject, /Grace Hopper/);
    assert.match(mail.text, /LINK/);
  }
});

test('MAIL_FROM splits into the sender name and address Brevo expects', async () => {
  const { parseSender } = await import('../lib/mail');
  assert.deepEqual(parseSender('Gained <gained.team@gmail.com>'), { name: 'Gained', email: 'gained.team@gmail.com' });
  assert.deepEqual(parseSender('"Gained Tutors" <a@b.co>'), { name: 'Gained Tutors', email: 'a@b.co' });
  assert.deepEqual(parseSender('a@b.co'), { email: 'a@b.co' });
  assert.deepEqual(parseSender('<a@b.co>'), { email: 'a@b.co' });
});

test('emails greet by first name, or the whole name when the first word can’t stand alone', async () => {
  const { first, verifyEmailMessage } = await import('../lib/emails');
  assert.match(verifyEmailMessage({ name: 'Ada Lovelace', link: 'L' }).text, /^Hi Ada,/);
  assert.match(verifyEmailMessage({ name: 'Adeyori’s Tutor', link: 'L' }).text, /^Hi Adeyori’s Tutor,/);
  assert.equal(first("Adeyori's Tutor"), "Adeyori's Tutor");
  assert.equal(first('Dr. Maya Okafor'), 'Dr. Maya Okafor');
  assert.equal(first('  Ada   Lovelace '), 'Ada');
  assert.equal(first('   '), 'there');
});
