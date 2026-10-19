// Problem of the day: which problem a day gets, which days a client may claim as "today", and
// streaks. Pure functions (no database), shared by the server action, the page and the tests.

import { DAILY_PROBLEMS } from './daily-problems';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for a date in the viewer's local time zone. */
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const utcDayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const toUtcMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const isDayKey = (key: unknown): key is string =>
  typeof key === 'string' && DAY_KEY.test(key) && utcDayKey(toUtcMs(key)) === key;

/** Puzzle number, counted from 1 on 2026-01-01. */
export const dayNumber = (key: string) => Math.round((toUtcMs(key) - EPOCH) / DAY_MS) + 1;

export const previousDay = (key: string) => utcDayKey(toUtcMs(key) - DAY_MS);

export function problemFor(key: string) {
  const n = DAILY_PROBLEMS.length;
  return DAILY_PROBLEMS[(((dayNumber(key) - 1) % n) + n) % n];
}

/**
 * The days that are "today" somewhere on Earth right now (UTC−12 to UTC+14). The client sends
 * its local date; anything outside this set is rejected, so nobody can bank future days.
 */
export function plausibleToday(key: string, now = new Date()): boolean {
  const t = now.getTime();
  return [utcDayKey(t - 12 * 3600_000), utcDayKey(t), utcDayKey(t + 14 * 3600_000)].includes(key);
}

/**
 * The current streak: consecutive solved days ending today, or ending yesterday if today
 * isn't solved yet (the streak is still alive until midnight). Best is the longest run ever.
 */
export function streaks(solvedDays: string[], today: string): { current: number; best: number } {
  const solved = new Set(solvedDays);
  let current = 0;
  for (let d = solved.has(today) ? today : previousDay(today); solved.has(d); d = previousDay(d)) current++;

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...solved].sort()) {
    run = prev !== null && previousDay(d) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
}
