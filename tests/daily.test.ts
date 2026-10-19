import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, isDayKey, plausibleToday, previousDay, problemFor, streaks } from '../lib/daily';
import { DAILY_PROBLEMS } from '../lib/daily-problems';

test('day keys must be real calendar dates', () => {
  assert.equal(isDayKey('2026-10-16'), true);
  assert.equal(isDayKey('2026-02-30'), false);
  assert.equal(isDayKey('2026-1-5'), false);
  assert.equal(isDayKey(20261016), false);
});

test('days count from 1 on 2026-01-01 and cross month and year ends', () => {
  assert.equal(dayNumber('2026-01-01'), 1);
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2027-01-01'), '2026-12-31');
});

test('the problem list cycles, one problem per day', () => {
  const n = DAILY_PROBLEMS.length;
  assert.equal(problemFor('2026-01-01'), DAILY_PROBLEMS[0]);
  assert.equal(problemFor('2026-01-02'), DAILY_PROBLEMS[1]);
  const later = new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  assert.equal(problemFor(later), DAILY_PROBLEMS[0]);
});

test('every problem has four options and a valid answer', () => {
  for (const p of DAILY_PROBLEMS) {
    assert.equal(p.options.length, 4, p.question);
    assert.ok(p.answer >= 0 && p.answer < 4, p.question);
  }
});

test('only dates that are today somewhere on Earth are accepted', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  assert.equal(plausibleToday('2026-10-16', now), true);
  assert.equal(plausibleToday('2026-10-17', now), true); // UTC+14 is already past midnight
  assert.equal(plausibleToday('2026-10-15', now), false);
  assert.equal(plausibleToday('2026-10-18', now), false);
});

test('the streak counts back from today, or from yesterday until today is solved', () => {
  const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
  assert.deepEqual(streaks(days, '2026-10-15'), { current: 4, best: 4 });
  assert.deepEqual(streaks(days, '2026-10-16'), { current: 4, best: 4 });
  assert.deepEqual(streaks(days, '2026-10-17'), { current: 0, best: 4 });
});

test('best streak is the longest run, even after a break', () => {
  const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-15', '2026-10-16'];
  assert.deepEqual(streaks(days, '2026-10-16'), { current: 2, best: 3 });
  assert.deepEqual(streaks([], '2026-10-16'), { current: 0, best: 0 });
});
