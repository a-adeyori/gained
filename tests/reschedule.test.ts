import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCancel } from '../lib/cancellation';
import { rescheduledEmail } from '../lib/emails';
import { canReschedule, checkNewTime, freeCancelAfterMove, rescheduleOptions } from '../lib/reschedule';

const HOUR = 3_600_000;
const now = new Date('2026-11-11T12:00:00Z');
const at = (h: number) => new Date(now.getTime() + h * HOUR);
const session = (startHours: number, status = 'booked') => ({
  id: 's1',
  status,
  start_at: at(startHours),
  end_at: at(startHours + 1),
  price_cents: 6000,
  tutor_id: 'tutor',
  payer_id: 'parent',
  student_id: 'kid',
  free_cancel_until: null as Date | null,
});
const parent = { id: 'parent', role: 'parent' };
const tutor = { id: 'tutor', role: 'tutor' };
const kid = { id: 'kid', role: 'student' };
const authorizedAt = at(-24);
// The tutor is open from 48 to 52 hours from now; another family has 49:00-50:00.
const availability = [{ start_at: at(48), end_at: at(52) }];
const others = [{ id: 'other', start_at: at(49), end_at: at(50), status: 'booked', created_at: at(-5), has_escrow: true }];

test('the tutor and the payer can move a booked session, before it or after a no-show', () => {
  assert.deepEqual(canReschedule(session(5), parent, now), { ok: true, as: 'family' });
  assert.deepEqual(canReschedule(session(5), tutor, now), { ok: true, as: 'tutor' });
  assert.deepEqual(canReschedule(session(-2), tutor, now), { ok: true, as: 'tutor' }, 'nobody started it: still movable');
  assert.ok(!canReschedule(session(-30), tutor, now).ok, 'not once 24 hours past the end');
  assert.ok(!canReschedule(session(5, 'live'), tutor, now).ok, 'not once started');
  const child = canReschedule(session(5), kid, now);
  assert.ok(!child.ok && !child.hidden && /Ask them/.test(child.reason));
});

test('only free times in the tutor’s open time, the same length, are offered', () => {
  const options = rescheduleOptions(session(5), availability, others, authorizedAt, now).map((d) => (d.getTime() - now.getTime()) / HOUR);
  assert.deepEqual(options, [48, 50, 50.5, 51]);
});

test('the new time is checked again on the server', () => {
  const ctx = { availability, others, authorizedAt, now };
  assert.ok(checkNewTime(session(5), at(48), ctx).ok);
  assert.ok(!checkNewTime(session(5), at(49), ctx).ok, 'taken');
  assert.ok(!checkNewTime(session(5), at(51.5), ctx).ok, 'runs past the open time');
  assert.ok(!checkNewTime(session(5), at(-1), ctx).ok, 'in the past');
  const old = { ...ctx, authorizedAt: at(-20 * 24) };
  assert.match((checkNewTime(session(5), at(48), old) as { error: string }).error, /payment hold/, 'beyond the life of the hold');
});

test('moving inside the late window doesn’t dodge the late fee', () => {
  // The family moves a session that starts in 5 hours: later cancellations stay late.
  const lateMove = { ...session(48), free_cancel_until: freeCancelAfterMove(session(5), 'family', now, at(48)) };
  assert.deepEqual(canCancel(lateMove, parent, now), { ok: true, as: 'family', feeCents: 3000 });
  // An early move by the family: the usual 24 hours before the new time.
  assert.equal(freeCancelAfterMove(session(72), 'family', now, at(48)), null);
  // The tutor moved it: the family can cancel free right up to the new time.
  const tutorMove = { ...session(10), free_cancel_until: freeCancelAfterMove(session(5), 'tutor', now, at(10)) };
  assert.deepEqual(canCancel(tutorMove, parent, now), { ok: true, as: 'family', feeCents: 0 });
});

test('the moved-session email gives the new and old time, and nothing new is charged', () => {
  const base = {
    subject: 'Math',
    studentName: 'Ada',
    tutorName: 'Ifenna',
    oldStart: new Date('2026-11-13T00:00:00Z'),
    newStart: new Date('2026-11-14T00:00:00Z'),
    meetingLink: null,
    link: 'L',
    timeZone: 'America/Chicago',
  };
  const payer = rescheduledEmail({ ...base, to: 'payer', by: 'tutor', contact: { name: 'Ifenna', email: 't@example.com' } });
  assert.match(payer.text, /^Ifenna moved the Math session\./);
  assert.match(payer.text, /New time: Friday, November 13 at 6:00 PM CST\nWas: Thursday, November 12 at 6:00 PM CST/);
  assert.match(payer.text, /nothing new is charged/);
  assert.match(payer.text, /cancel it free/);
  const tutorMail = rescheduledEmail({ ...base, to: 'tutor', by: 'family' });
  assert.match(tutorMail.text, /^The family moved the Math session with Ada\./);
  assert.doesNotMatch(rescheduledEmail({ ...base, to: 'student', by: 'family' }).text, /@|charged/);
});
