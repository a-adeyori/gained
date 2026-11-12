'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { restingState } from '@/lib/escrow';
import { JOBS, startJob, type JobName } from '@/lib/jobs';
import { baseCentsFor } from '@/lib/payout';

export type AdminState = { error?: string; ok?: string } | undefined;

/**
 * Resolve an appeal: either the grade stands, or the admin sets the total tutor pay that will
 * be captured at settlement (never below the 80% base, never above the price).
 */
export async function resolveAppeal(appealId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  await requireUser('admin');
  const appeal = await db.appeal.findUnique({ where: { id: appealId }, include: { session: true } });
  if (!appeal || appeal.status !== 'open') return { error: 'This appeal is already resolved.' };

  const decision = String(form.get('decision'));
  const note = String(form.get('resolution') ?? '').trim();
  if (!note) return { error: 'Add a short note for the family and tutor.' };

  let override: number | null = null;
  if (decision === 'adjusted') {
    const dollars = Number(String(form.get('tutor_pay') ?? '').replace(/[$,]/g, ''));
    if (!Number.isFinite(dollars)) return { error: 'Enter the total tutor pay in dollars.' };
    const cents = Math.round(dollars * 100);
    const { price_cents } = appeal.session;
    if (cents < baseCentsFor(price_cents) || cents > price_cents) return { error: 'Tutor pay must be between the 80% base and the full price.' };
    override = cents;
  } else if (decision !== 'upheld') {
    return { error: 'Choose a decision.' };
  }

  const sessionId = appeal.session_id;
  await db.$transaction([
    db.appeal.update({ where: { id: appealId }, data: { status: decision, resolution: note, resolved_at: new Date() } }),
    ...(override !== null
      ? [
          db.result.upsert({
            where: { session_id: sessionId },
            create: { session_id: sessionId, override_tutor_pay_cents: override },
            update: { override_tutor_pay_cents: override },
          }),
        ]
      : []),
  ]);
  await db.escrow.update({ where: { session_id: sessionId }, data: { state: await restingState(sessionId) } });
  revalidatePath('/admin/appeals');
  return { ok: 'Resolved. Settlement continues on its normal schedule.' };
}

/** Re-run a pipeline step after a failure (every step is safe to repeat). */
export async function retryJob(sessionId: string, form: FormData) {
  await requireUser('admin');
  const job = String(form.get('job')) as JobName;
  if (!JOBS.includes(job)) return;
  // A cancelled booking only ever has its hold released; no other step may run on it.
  const session = await db.session.findUnique({ where: { id: sessionId }, select: { status: true } });
  if (!session || (session.status === 'cancelled') !== (job === 'cancelSession')) return;
  if (job === 'gradeQuiz') {
    const quizId = String(form.get('quiz_id') ?? '');
    if (quizId) await startJob('gradeQuiz', quizId);
  } else {
    if (job === 'settleSession') await db.session.update({ where: { id: sessionId }, data: { status: 'settling' } });
    await db.session.update({ where: { id: sessionId }, data: { pipeline_error: null } });
    await startJob(job, sessionId);
  }
  revalidatePath('/admin');
}
