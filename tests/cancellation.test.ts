import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCancel, cancellationFeeCents, freeCancelUntil } from '../lib/cancellation';
import { cancelledEmail } from '../lib/emails';

const HOUR = 3_600_000;
const now = new Date('2026-11-11T12:00:00Z');
const session = (hoursAway: number, status = 'booked') => ({
  status,
  start_at: new Date(now.getTime() + hoursAway * HOUR),
  price_cents: 6000,
  tutor_id: 'tutor',
  payer_id: 'parent',
  student_id: 'kid',
});
const parent = { id: 'parent', role: 'parent' };
const tutor = { id: 'tutor', role: 'tutor' };
const kid = { id: 'kid', role: 'student' };
const admin = { id: 'boss', role: 'admin' };

test('the payer cancels free until 24 hours before the start, then pays the tutor half', () => {
  assert.deepEqual(canCancel(session(48), parent, now), { ok: true, as: 'family', feeCents: 0 });
  assert.deepEqual(canCancel(session(24.01), parent, now), { ok: true, as: 'family', feeCents: 0 });
  assert.deepEqual(canCancel(session(23), parent, now), { ok: true, as: 'family', feeCents: 3000 });
  assert.deepEqual(canCancel(session(0.1), parent, now), { ok: true, as: 'family', feeCents: 3000 });
  assert.equal(freeCancelUntil(session(48)).toISOString(), '2026-11-12T12:00:00.000Z');
});

test('the tutor and admins can cancel any time before the start, and the family pays nothing', () => {
  assert.deepEqual(canCancel(session(1), tutor, now), { ok: true, as: 'tutor', feeCents: 0 });
  assert.deepEqual(canCancel(session(1), admin, now), { ok: true, as: 'admin', feeCents: 0 });
});

test('a student who didn’t pay is told to ask the payer; a self-paying student can cancel', () => {
  const check = canCancel(session(48), kid, now);
  assert.equal(check.ok, false);
  assert.ok(!check.ok && !check.hidden && /Ask them/.test(check.reason));
  assert.deepEqual(canCancel({ ...session(48), payer_id: 'kid' }, kid, now), { ok: true, as: 'family', feeCents: 0 });
});

test('nobody cancels a session that has started, ended or is already cancelled', () => {
  for (const s of [session(-0.1), session(5, 'live'), session(5, 'ended'), session(48, 'cancelled')]) {
    for (const who of [parent, tutor, admin]) {
      const check = canCancel(s, who, now);
      assert.ok(!check.ok && check.hidden, `${who.id} on ${s.status}`);
    }
  }
  const stranger = canCancel(session(48), { id: 'x', role: 'tutor' }, now);
  assert.ok(!stranger.ok && stranger.hidden);
});

test('afterwards, the fee follows from who cancelled and when', () => {
  const cancelled = (by: string, hoursBefore: number) => ({
    ...session(48),
    cancelled_by_id: by,
    cancelled_at: new Date(session(48).start_at.getTime() - hoursBefore * HOUR),
  });
  assert.equal(cancellationFeeCents(cancelled('parent', 30)), 0);
  assert.equal(cancellationFeeCents(cancelled('parent', 2)), 3000);
  assert.equal(cancellationFeeCents(cancelled('tutor', 2)), 0, 'a tutor cancelling late costs the family nothing');
  assert.equal(cancellationFeeCents(cancelled('boss', 2)), 0, 'nor does an admin');
});

const mail = {
  subject: 'Math',
  studentName: 'Ada Obi',
  tutorName: 'Ifenna',
  startAt: new Date('2026-11-13T00:00:00Z'),
  priceCents: 6000,
  feeCents: 0,
  link: 'L',
  timeZone: 'America/Chicago',
};

test('the cancellation email tells each person what it means for them', () => {
  const payer = cancelledEmail({ ...mail, to: 'payer', by: 'tutor', reason: 'I’m unwell' });
  assert.match(payer.text, /^Ifenna cancelled the Math session on Thursday, November 12 at 6:00 PM CST\./);
  assert.match(payer.text, /Reason given: I’m unwell/);
  assert.match(payer.text, /Nothing was charged\. The \$60\.00 hold/);
  const tutorMail = cancelledEmail({ ...mail, to: 'tutor', by: 'family', reason: null });
  assert.match(tutorMail.text, /The family cancelled the Math session with Ada Obi/);
  assert.match(tutorMail.text, /No payment is made/);
  assert.doesNotMatch(tutorMail.text, /Reason given/);
  const own = cancelledEmail({ ...mail, to: 'tutor', by: 'tutor', reason: null });
  assert.match(own.text, /^You cancelled your Math session with Ada Obi/);
  assert.match(cancelledEmail({ ...mail, to: 'student', by: 'family', reason: null }).text, /^Hi Ada,/);
});

test('a late cancellation email says what was charged, what came back, and what the tutor gets', () => {
  const late = { ...mail, by: 'family' as const, reason: null, feeCents: 3000 };
  const payer = cancelledEmail({ ...late, to: 'payer' });
  assert.match(payer.text, /\$30\.00 \(half the price\) was charged and goes to Ifenna/);
  assert.match(payer.text, /The other \$30\.00 of the hold is released/);
  assert.doesNotMatch(payer.text, /Nothing was charged/);
  assert.match(cancelledEmail({ ...late, to: 'tutor' }).text, /you're paid \$30\.00, half the price/);
  assert.doesNotMatch(cancelledEmail({ ...late, to: 'student' }).text, /\$/);
});
