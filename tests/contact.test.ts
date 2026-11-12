import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookedEmail, reminderEmail } from '../lib/emails';

const base = { subject: 'Math', studentName: 'Ada', tutorName: 'Ifenna', startAt: new Date('2026-11-13T00:00:00Z'), meetingLink: null, link: 'L' };
const tutor = { name: 'Ifenna', email: 'tutor@example.com' };
const parent = { name: 'Jinn', email: 'parent@example.com' };

test('the parent and the tutor get each other’s email in booking and reminder emails', () => {
  assert.match(bookedEmail({ ...base, to: 'payer', priceCents: 6000, contact: tutor }).text, /To reach Ifenna, email tutor@example\.com\./);
  assert.match(bookedEmail({ ...base, to: 'tutor', priceCents: 6000, contact: parent }).text, /To reach Jinn, email parent@example\.com\./);
  assert.match(reminderEmail({ ...base, to: 'payer', warmUpLink: null, contact: tutor }).text, /tutor@example\.com/);
  assert.match(reminderEmail({ ...base, to: 'tutor', warmUpLink: null, contact: parent }).text, /parent@example\.com/);
});

test('a student who didn’t pay never gets the tutor’s email', () => {
  assert.doesNotMatch(bookedEmail({ ...base, to: 'student', priceCents: 6000 }).text, /@/);
  assert.doesNotMatch(reminderEmail({ ...base, to: 'student', warmUpLink: null, contact: null }).text, /@/);
});
