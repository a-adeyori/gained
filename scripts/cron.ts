// The Render Cron Job, every 15 minutes (Render Workflows can't wait 48 hours or schedule):
//   1. counts a session as confirmed by the family 24 hours after the tutor ended it,
//      and releases the base;
//   2. sends retention quizzes 48 hours after the session ends, open for 12 hours;
//   3. triggers settleSession once the retention quiz is graded or closed and the 72-hour
//      appeal window has passed with no open appeal.

import { db } from '../lib/db';
import { startJob } from '../lib/jobs';
import { notifyQuiz } from '../lib/notify';
import { AUTO_CONFIRM_HOURS, readyToSettle, retentionAction, retentionClosesAt } from '../lib/retention';

const HOUR = 3_600_000;
const wait = process.env.WORKFLOW_MODE === 'inline';

async function autoConfirm(now: Date) {
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
}

async function sendRetentionQuizzes(now: Date) {
  const quizzes = await db.quiz.findMany({
    where: { kind: 'retention', sent_at: null, session: { ended_at: { not: null } } },
    include: { session: { select: { ended_at: true } } },
  });
  for (const quiz of quizzes) {
    const action = retentionAction(
      { sessionEndedAt: quiz.session.ended_at!, sent_at: null, closes_at: null, completed_at: null },
      now,
    );
    if (action !== 'send') continue;
    await db.quiz.update({ where: { id: quiz.id }, data: { sent_at: now, closes_at: retentionClosesAt(now) } });
    await notifyQuiz(quiz.id);
    console.log(`sent retention quiz ${quiz.id}`);
  }
}

async function settleDue(now: Date) {
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
  }
}

async function main() {
  const now = new Date();
  await autoConfirm(now);
  await sendRetentionQuizzes(now);
  await settleDue(now);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
