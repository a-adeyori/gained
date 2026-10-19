'use server';

import { currentUser } from '@/lib/auth';
import { isDayKey, plausibleToday, problemFor } from '@/lib/daily';
import { db } from '@/lib/db';

export type DailyAnswer =
  | { ok: true; day: string; picks: number[]; solved: boolean; solvedDays: string[] }
  | { ok: false; error: string };

/** Records one pick on the student's problem for `day` (their local date). Grading happens here. */
export async function answerDaily(day: string, pick: number): Promise<DailyAnswer> {
  const user = await currentUser();
  if (!user || user.role !== 'student') return { ok: false, error: 'Sign in as a student to play.' };
  if (!isDayKey(day) || !plausibleToday(day)) return { ok: false, error: 'Refresh the page for today’s problem.' };
  if (!Number.isInteger(pick) || pick < 0 || pick > 3) return { ok: false, error: 'Pick one of the answers.' };

  const problem = problemFor(day);
  const key = { user_id_day: { user_id: user.id, day } };
  const existing = await db.dailyAttempt.findUnique({ where: key });

  let picks = existing?.picks ?? [];
  let solved = Boolean(existing?.solved_at);
  if (!solved && !picks.includes(pick)) {
    picks = [...picks, pick];
    solved = pick === problem.answer;
    await db.dailyAttempt.upsert({
      where: key,
      create: { user_id: user.id, day, picks, solved_at: solved ? new Date() : null },
      update: { picks, solved_at: solved ? new Date() : null },
    });
  }

  const solvedRows = await db.dailyAttempt.findMany({
    where: { user_id: user.id, solved_at: { not: null } },
    select: { day: true },
  });
  return { ok: true, day, picks, solved, solvedDays: solvedRows.map((r) => r.day) };
}
