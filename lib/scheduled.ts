// The work that runs every 15 minutes (nothing else can wait 48 hours):
//   0. emails a "starting soon" reminder with the meeting link about an hour before a session;
//   1. counts a session as confirmed by the family 24 hours after the tutor ended it,
//      and releases the base;
//   2. sends retention quizzes 48 hours after the session ends, open for 12 hours;
//   3. triggers settleSession once the retention quiz is graded or closed and the 72-hour
//      appeal window has passed with no open appeal.
// Run by `npm run cron` (a Render Cron Job on paid plans) or POST /api/cron (called by a
// scheduled GitHub Action on the free plan). Every step is safe to run twice. Server-only.

import { db } from './db';
import { startJob } from './jobs';
import { notifyQuiz, notifyReminder } from './notify';
import { AUTO_CONFIRM_HOURS, readyToSettle, retentionAction, retentionClosesAt } from './retention';

const HOUR = 3_600_000;
/** Reminders go out once a session is this close; with a 15-minute cron, 45-60 minutes ahead. */
const REMINDER_MINUTES = 60;
/** Bookings made closer to the start than this just got the booking email, so they skip the reminder. */
const REMINDER_MIN_LEAD_HOURS = 2;

type Options = { now?: Date; /** Await each job (inline mode in a script that exits when done). */ wait?: boolean };
export type ScheduledResult = { remindersSent: number; autoConfirmed: number; retentionSent: number; settling: number };

export async function runScheduledTasks({ now = new Date(), wait = false }: Options = {}): Promise<ScheduledResult> {
  return {
    remindersSent: await sendReminders(now),
    autoConfirmed: await autoConfirm(now, wait),
    retentionSent: await sendRetentionQuizzes(now),
    settling: await settleDue(now, wait),
  };
}

async function sendReminders(now: Date) {
  const due = await db.session.findMany({
    where: {
      // Booked and paid for (the hold was approved), starting within the hour, not yet reminded.
      status: 'booked',
      escrow: { isNot: null },
      reminder_sent_at: null,
      start_at: { gt: now, lte: new Date(now.getTime() + REMINDER_MINUTES * 60_000) },
    },
    select: { id: true, start_at: true, created_at: true },
  });
  let sent = 0;
  for (const s of due) {
    if (s.start_at.getTime() - s.created_at.getTime() < REMINDER_MIN_LEAD_HOURS * HOUR) continue;
    // Claimed before sending, so two overlapping runs can't both send it.
    const claimed = await db.session.updateMany({ where: { id: s.id, reminder_sent_at: null }, data: { reminder_sent_at: now } });
    if (!claimed.count) continue;
    await notifyReminder(s.id);
    console.log(`sent reminder for ${s.id}`);
    sent++;
  }
  return sent;
}

async function autoConfirm(now: Date, wait: boolean) {
  const due = await db.session.findMany({
    where: {
      tutor_confirmed_at: { lte: new Date(now.getTime() - AUTO_CONFIRM_HOURS * HOUR) },
      family_confirmed_at: null,
      appeals: { none: { status: 'open' } },
      escrow: { isNot: null },
    },
    select: { id: true },
  });
  for (const { id } of due) {
    await db.session.update({ where: { id }, data: { family_confirmed_at: now } });
    await startJob('releasePayment', id, { wait });
    console.log(`auto-confirmed ${id}; base released`);
  }
  return due.length;
}

async function sendRetentionQuizzes(now: Date) {
  const quizzes = await db.quiz.findMany({
    where: { kind: 'retention', sent_at: null, session: { ended_at: { not: null } } },
    include: { session: { select: { ended_at: true } } },
  });
  let sent = 0;
  for (const quiz of quizzes) {
    const action = retentionAction(
      { sessionEndedAt: quiz.session.ended_at!, sent_at: null, closes_at: null, completed_at: null },
      now,
    );
    if (action !== 'send') continue;
    await db.quiz.update({ where: { id: quiz.id }, data: { sent_at: now, closes_at: retentionClosesAt(now) } });
    await notifyQuiz(quiz.id);
    console.log(`sent retention quiz ${quiz.id}`);
    sent++;
  }
  return sent;
}

async function settleDue(now: Date, wait: boolean) {
  const candidates = await db.session.findMany({
    where: {
      status: 'complete',
      ended_at: { not: null },
      escrow: { state: { in: ['base_paid', 'awaiting_retention'] } },
    },
    include: {
      escrow: true,
      quizzes: { where: { kind: 'retention' } },
      _count: { select: { appeals: { where: { status: 'open' } } } },
    },
  });
  let settling = 0;
  for (const session of candidates) {
    const retention = session.quizzes[0];
    const ready = readyToSettle({
      sessionEndedAt: session.ended_at!,
      escrowState: session.escrow!.state,
      retention: retention ? { sessionEndedAt: session.ended_at!, ...retention, graded: retention.score !== null } : null,
      openAppeals: session._count.appeals,
      now,
    });
    if (!ready) continue;
    // Marked first so the next run doesn't start a second settlement while this one runs.
    await db.session.update({ where: { id: session.id }, data: { status: 'settling' } });
    await startJob('settleSession', session.id, { wait });
    console.log(`settling ${session.id}`);
    settling++;
  }
  return settling;
}
