import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookedEmail, quizEmail, reminderEmail } from '../lib/emails';
import { isTimeZone, otherTimeZones, timeZoneLabel } from '../lib/time-zone';

// 00:00 UTC on Nov 13 is 6 PM Thursday in Chicago and 1 AM Friday in Lagos.
const startAt = new Date('2026-11-13T00:00:00Z');
const base = { subject: 'Math', studentName: 'Ada', tutorName: 'Ifenna', startAt, meetingLink: null, link: 'L' };

test('emails show times in each recipient’s own time zone, and say which', () => {
  const parent = bookedEmail({ ...base, to: 'payer', priceCents: 6000, timeZone: 'America/Chicago' });
  assert.match(parent.text, /Thursday, November 12 at 6:00 PM CST/);
  const tutor = reminderEmail({ ...base, to: 'tutor', warmUpLink: null, timeZone: 'Africa/Lagos' });
  assert.match(tutor.text, /Friday, November 13 at 1:00 AM GMT\+1/);
  const quiz = quizEmail({ kind: 'retention', studentName: 'Ada', subject: 'Math', tutorName: 'Ifenna', link: 'L', closesAt: startAt, timeZone: 'America/Chicago' });
  assert.match(quiz.text, /open until Thursday, November 12 at 6:00 PM CST/);
});

test('without a saved time zone, emails use UTC on any server', () => {
  const mail = bookedEmail({ ...base, to: 'payer', priceCents: 6000, timeZone: null });
  assert.match(mail.text, /Friday, November 13 at 12:00 AM UTC/);
});

test('only real time zones are accepted', () => {
  assert.equal(isTimeZone('America/Chicago'), true);
  assert.equal(isTimeZone('Africa/Lagos'), true);
  assert.equal(isTimeZone('Mars/Olympus_Mons'), false);
  assert.equal(isTimeZone(''), false);
  assert.equal(isTimeZone(42), false);
});

test('the Account page lists US zones by name, then a shorter list of everywhere else', () => {
  assert.equal(timeZoneLabel('America/Chicago', startAt), 'Central Time (CST)');
  assert.equal(timeZoneLabel('America/New_York', new Date('2026-07-01T12:00:00Z')), 'Eastern Time (EDT)');
  assert.equal(timeZoneLabel('Africa/Lagos', startAt), 'Africa / Lagos (GMT+1)');
  const others = otherTimeZones();
  assert.ok(others.includes('Africa/Lagos') && others.includes('Europe/London') && others.includes('America/Toronto'));
  assert.ok(!others.includes('America/Chicago') && !others.includes('America/Indiana/Knox'), 'US zones are listed once, by name');
  assert.ok(others.filter((tz) => tz.startsWith('America/')).length < 20);
});
