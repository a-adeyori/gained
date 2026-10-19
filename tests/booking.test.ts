import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkStillBookable,
  isBlocking,
  normalizeSubjects,
  openStarts,
  overlaps,
  parseDollars,
  prorateCents,
  validateAvailability,
  validateBooking,
  type BookingContext,
  type BookingRequest,
  type SessionSlot,
} from '../lib/booking';

const now = new Date('2026-10-16T12:00:00Z');
const at = (hhmm: string, day = '2026-10-17') => new Date(`${day}T${hhmm}:00Z`);
const range = (from: string, to: string) => ({ start_at: at(from), end_at: at(to) });

const held = (from: string, to: string, extra: Partial<SessionSlot> = {}): SessionSlot => ({
  ...range(from, to),
  status: 'booked',
  created_at: new Date('2026-10-10T00:00:00Z'),
  has_escrow: true,
  ...extra,
});

const ctx = (over: Partial<BookingContext> = {}): BookingContext => ({
  now,
  payerId: 'parent',
  childIds: ['kid'],
  tutor: { id: 'tutor', role: 'tutor', subjects: ['Math'], price_cents: 6000 },
  availability: [range('14:00', '17:00')],
  sessions: [],
  ...over,
});

const req = (over: Partial<BookingRequest> = {}): BookingRequest => ({
  tutorId: 'tutor',
  studentId: 'kid',
  startAt: at('14:00'),
  durationMin: 60,
  subject: 'Math',
  plannedTopics: 'Quadratics and factoring',
  ...over,
});

test('ranges that only touch do not overlap', () => {
  assert.equal(overlaps(range('14:00', '15:00'), range('15:00', '16:00')), false);
  assert.equal(overlaps(range('14:00', '15:30'), range('15:00', '16:00')), true);
  assert.equal(overlaps(range('14:00', '17:00'), range('15:00', '16:00')), true);
});

test('price is prorated from the 60-minute price', () => {
  assert.equal(prorateCents(6000, 60), 6000);
  assert.equal(prorateCents(6000, 30), 3000);
  assert.equal(prorateCents(6000, 90), 9000);
  assert.equal(prorateCents(4999, 30), 2500);
});

test('dollar input parses to cents', () => {
  assert.equal(parseDollars('45'), 4500);
  assert.equal(parseDollars('$45.5'), 4550);
  assert.equal(parseDollars('1,000.00'), 100000);
  assert.equal(parseDollars('abc'), null);
  assert.equal(parseDollars('4.555'), null);
});

test('only known subjects survive, in canonical spelling', () => {
  assert.deepEqual(normalizeSubjects(['physics', 'Astrology', 'MATH', 'math', 'computer science']), ['Math', 'Physics', 'Computer Science']);
});

test('a valid booking returns the end time and price', () => {
  const r = validateBooking(req({ durationMin: 90 }), ctx());
  assert.ok(r.ok);
  assert.deepEqual(r.endAt, at('15:30'));
  assert.equal(r.priceCents, 9000);
});

test('the parent can book for themself as the student', () => {
  assert.ok(validateBooking(req({ studentId: 'parent' }), ctx()).ok);
});

test('someone else’s child is rejected', () => {
  assert.equal(validateBooking(req({ studentId: 'other-kid' }), ctx()).ok, false);
});

test('session must fit inside an availability range', () => {
  assert.equal(validateBooking(req({ startAt: at('16:30'), durationMin: 60 }), ctx()).ok, false);
  assert.ok(validateBooking(req({ startAt: at('16:30'), durationMin: 30 }), ctx()).ok);
  assert.equal(validateBooking(req({ startAt: at('13:30') }), ctx()).ok, false);
});

test('overlapping a held session is rejected, touching it is fine', () => {
  const c = ctx({ sessions: [held('15:00', '16:00')] });
  assert.equal(validateBooking(req({ startAt: at('14:30') }), c).ok, false);
  assert.ok(validateBooking(req({ startAt: at('14:00') }), c).ok);
  assert.ok(validateBooking(req({ startAt: at('16:00') }), c).ok);
});

test('cancelled and stale unapproved sessions do not block', () => {
  const c = ctx({
    sessions: [
      held('14:00', '15:00', { status: 'cancelled' }),
      held('15:00', '16:00', { has_escrow: false, created_at: new Date('2026-10-16T11:00:00Z') }),
    ],
  });
  assert.ok(validateBooking(req({ startAt: at('14:00'), durationMin: 90 }), c).ok);
});

test('a fresh unapproved booking still blocks', () => {
  const fresh = held('14:00', '15:00', { has_escrow: false, created_at: new Date('2026-10-16T11:50:00Z') });
  assert.equal(isBlocking(fresh, now), true);
  assert.equal(validateBooking(req(), ctx({ sessions: [fresh] })).ok, false);
});

test('past times, unknown subjects and empty topics are rejected', () => {
  const past = ctx({ availability: [{ start_at: new Date('2026-10-16T10:00:00Z'), end_at: at('17:00') }] });
  assert.equal(validateBooking(req({ startAt: new Date('2026-10-16T11:00:00Z') }), past).ok, false);
  assert.equal(validateBooking(req({ subject: 'Astrology' }), ctx()).ok, false);
  assert.equal(validateBooking(req({ subject: 'Physics' }), ctx()).ok, false);
  assert.equal(validateBooking(req({ plannedTopics: '   ' }), ctx()).ok, false);
  assert.equal(validateBooking(req({ durationMin: 45 }), ctx()).ok, false);
});

test('a tutor without a price cannot be booked', () => {
  const c = ctx({ tutor: { id: 'tutor', role: 'tutor', subjects: ['Math'], price_cents: null } });
  assert.equal(validateBooking(req(), c).ok, false);
});

test('open start times skip booked slots and the past', () => {
  const starts = openStarts(range('14:00', '17:00'), 60, [held('15:00', '16:00')], now);
  assert.deepEqual(starts, [at('14:00'), at('16:00')]);
  const today = { start_at: new Date('2026-10-16T11:00:00Z'), end_at: new Date('2026-10-16T14:00:00Z') };
  assert.deepEqual(openStarts(today, 60, [], now), [new Date('2026-10-16T12:30:00Z'), new Date('2026-10-16T13:00:00Z')]);
});

test('availability ranges are validated', () => {
  assert.ok(validateAvailability(range('09:00', '12:00'), [], now).ok);
  assert.equal(validateAvailability(range('12:00', '09:00'), [], now).ok, false);
  assert.equal(validateAvailability(range('09:00', '09:15'), [], now).ok, false);
  assert.equal(validateAvailability(range('09:00', '12:00'), [range('11:00', '13:00')], now).ok, false);
  assert.ok(validateAvailability(range('09:00', '11:00'), [range('11:00', '13:00')], now).ok);
  assert.equal(validateAvailability({ start_at: new Date('2026-10-16T08:00:00Z'), end_at: at('09:00') }, [], now).ok, false);
});

test('an unapproved booking is re-checked before the hold', () => {
  const mine = { ...held('14:00', '15:00', { has_escrow: false }), id: 'mine' };
  assert.ok(checkStillBookable(mine, [mine], now).ok);
  assert.equal(checkStillBookable(mine, [mine, { ...held('14:30', '15:30'), id: 'other' }], now).ok, false);
  assert.equal(checkStillBookable({ ...mine, start_at: new Date('2026-10-16T11:00:00Z') }, [], now).ok, false);
});
