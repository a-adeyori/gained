'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { canCancel, MAX_CANCEL_REASON } from '@/lib/cancellation';
import { db } from '@/lib/db';
import { startJob } from '@/lib/jobs';
import { appealWindowClosesAt } from '@/lib/retention';

export type CancelState = { error?: string } | undefined;

/**
 * Cancel before the start (rules in lib/cancellation.ts). The session is marked cancelled at
 * once, so the slot reopens and no quiz or reminder goes out; the cancelSession job then voids
 * the PayPal hold and emails everyone.
 */
export async function cancelSession(sessionId: string, _prev: CancelState, form: FormData): Promise<CancelState> {
  const user = await requireUser();
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return { error: 'Session not found.' };
  const now = new Date();
  const check = canCancel(session, user, now);
  if (!check.ok) return { error: check.reason };
  // The free window can close while the confirmation is open; never charge a fee nobody saw.
  if (check.feeCents > Number(form.get('shownFeeCents') ?? 0)) {
    return { error: 'Free cancellation just ended, so cancelling now costs half the price. Refresh the page to see the new terms.' };
  }

  const reason = String(form.get('reason') ?? '').trim().slice(0, MAX_CANCEL_REASON) || null;
  // Only a still-booked session that hasn't started, so a tutor tapping Start at the same moment wins.
  const { count } = await db.session.updateMany({
    where: { id: sessionId, status: 'booked', start_at: { gt: now } },
    data: { status: 'cancelled', cancelled_at: now, cancelled_by_id: user.id, cancel_reason: reason },
  });
  if (!count) return { error: 'The session has already started or changed. Refresh the page.' };

  await startJob('cancelSession', sessionId);
  redirect(`/sessions/${sessionId}`);
}

/** The family's side of "marked complete by both sides". */
export async function confirmSession(sessionId: string) {
  const user = await requireUser();
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session || ![session.payer_id, session.student_id].includes(user.id)) return;
  if (!session.family_confirmed_at) {
    await db.session.update({ where: { id: sessionId }, data: { family_confirmed_at: new Date() } });
    if (session.tutor_confirmed_at) await startJob('releasePayment', sessionId);
  }
  revalidatePath(`/sessions/${sessionId}`);
}

export type AppealState = { error?: string } | undefined;

/** Either side can dispute a grade within 72 hours; the final capture waits until it's resolved. */
export async function openAppeal(sessionId: string, _prev: AppealState, form: FormData): Promise<AppealState> {
  const user = await requireUser();
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { escrow: true, appeals: { where: { status: 'open' } } },
  });
  if (!session || ![session.payer_id, session.student_id, session.tutor_id].includes(user.id)) return { error: 'Session not found.' };
  if (!session.ended_at || new Date() > appealWindowClosesAt(session.ended_at)) return { error: 'The 72-hour appeal window has closed.' };
  if (session.appeals.length) return { error: 'There’s already an open appeal on this session.' };
  if (!session.escrow || ['settled', 'returned'].includes(session.escrow.state)) return { error: 'This session has already settled.' };

  const reason = String(form.get('reason') ?? '').trim();
  if (reason.length < 10) return { error: 'Tell us a little more about what seems wrong (at least a sentence).' };

  await db.$transaction([
    db.appeal.create({ data: { session_id: sessionId, opened_by: user.id, reason: reason.slice(0, 2000) } }),
    db.escrow.update({ where: { session_id: sessionId }, data: { state: 'in_appeal' } }),
  ]);
  redirect(`/sessions/${sessionId}`);
}
