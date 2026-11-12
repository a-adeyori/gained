// The escrow lifecycle, joining PayPal to the database. Only the booking steps run in the
// web service; captures, voids and payouts run only in workflow tasks. Server-only.

import { db } from './db';
import type { EscrowState } from './generated/prisma/enums';
import {
  authorizeOrder,
  captureEscrow,
  createAuthorizeOrder,
  createPayout,
  getAuthorization,
  voidAuthorization,
  type EscrowAuthPatch,
} from './paypal';
import { notifySettled } from './notify';
import { baseCentsFor, computeSplit, tutorNetCents } from './payout';
import { cancellationFeeCents } from './cancellation';

const saveEscrow = (sessionId: string) => async (patch: EscrowAuthPatch) => {
  await db.escrow.update({ where: { session_id: sessionId }, data: patch });
};

// --- Booking (web service) ------------------------------------------------------------

/** Create (or reuse) the PayPal order that will hold the full price. */
export async function createBookingOrder(sessionId: string): Promise<string> {
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { tutor: true } });
  if (session.paypal_order_id) return session.paypal_order_id;
  const { orderId } = await createAuthorizeOrder({
    sessionId,
    priceCents: session.price_cents,
    description: `${session.subject} session with ${session.tutor.name}`,
  });
  await db.session.update({ where: { id: sessionId }, data: { paypal_order_id: orderId } });
  return orderId;
}

/** After the parent approves in PayPal: place the hold and open the escrow. */
export async function authorizeBooking(sessionId: string) {
  const existing = await db.escrow.findUnique({ where: { session_id: sessionId } });
  if (existing) return existing;
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.paypal_order_id) throw new Error(`Session ${sessionId} has no PayPal order`);
  const auth = await authorizeOrder(session.paypal_order_id);
  return db.escrow.create({
    data: {
      session_id: sessionId,
      order_id: session.paypal_order_id,
      authorization_id: auth.id,
      authorized_at: new Date(),
      state: 'held',
    },
  });
}

// --- Captures and payouts (workflow only) ------------------------------------------------

async function payTutor(sessionId: string, part: 'base' | 'bonus' | 'late-cancel', capturedCents: number) {
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { tutor: true } });
  if (!session.tutor.paypal_email || capturedCents <= 0) return null;
  try {
    const payout = await createPayout({
      senderBatchId: `session-${sessionId}-${part}`,
      receiverEmail: session.tutor.paypal_email,
      amountCents: tutorNetCents(capturedCents),
      note: `Gained: ${session.subject} session, ${part === 'late-cancel' ? 'late cancellation' : part}`,
    });
    return payout.batch_header.payout_batch_id;
  } catch (err) {
    // A failed payout must not undo a capture. It's recorded for the admin to retry.
    console.error(`Payout ${part} failed for session ${sessionId}`, err);
    await db.session.update({
      where: { id: sessionId },
      data: { pipeline_error: `Payout (${part}) failed: ${err instanceof Error ? err.message : String(err)}` },
    });
    return null;
  }
}

/** Once both sides have marked the session complete: capture the guaranteed base. */
export async function captureBase(sessionId: string) {
  const escrow = await db.escrow.findUniqueOrThrow({ where: { session_id: sessionId }, include: { session: true } });
  if (escrow.base_capture_id) return escrow;
  if (escrow.state === 'cancelled') throw new Error(`Session ${sessionId} was cancelled, so nothing is captured`);
  const baseCents = baseCentsFor(escrow.session.price_cents);
  const { capture } = await captureEscrow(escrow, {
    amountCents: baseCents,
    finalCapture: false,
    key: `session-${sessionId}-base`,
    holdCents: escrow.session.price_cents,
    save: saveEscrow(sessionId),
  });
  // If the post-session quiz is already graded, the escrow moves straight on to awaiting retention.
  const postGraded = await db.quiz.count({ where: { session_id: sessionId, kind: 'post', score: { not: null } } });
  const state: EscrowState = escrow.state === 'in_appeal' ? 'in_appeal' : postGraded ? 'awaiting_retention' : 'base_paid';
  await db.escrow.update({ where: { session_id: sessionId }, data: { base_capture_id: capture.id, state } });
  const payoutId = await payTutor(sessionId, 'base', baseCents);
  return db.escrow.update({ where: { session_id: sessionId }, data: { base_payout_id: payoutId } });
}

/** The tutor's rolling average gain over their last 20 measured quizzes; 0.5 with no history. */
export async function tutorAverageGain(tutorId: string, excludeSessionId?: string): Promise<number> {
  const results = await db.result.findMany({
    where: { session: { tutor_id: tutorId, id: excludeSessionId ? { not: excludeSessionId } : undefined } },
    orderBy: { session: { start_at: 'desc' } },
    take: 20,
    select: { gain_quiz: true, gain_retention: true },
  });
  const gains = results.flatMap((r) => [r.gain_quiz, r.gain_retention]).filter((g): g is number => g !== null);
  return gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0.5;
}

/**
 * After the retention quiz and the appeal window: capture the earned bonus with
 * final_capture (releasing the rest to the parent), or void the hold if no bonus was earned.
 */
export async function settle(sessionId: string) {
  const escrow = await db.escrow.findUniqueOrThrow({
    where: { session_id: sessionId },
    include: { session: { include: { result: true, appeals: { where: { status: 'open' } } } } },
  });
  const { session } = escrow;
  if (escrow.state === 'settled' || escrow.state === 'returned' || escrow.state === 'cancelled') return escrow;
  if (session.appeals.length) throw new Error(`Session ${sessionId} has an open appeal`);
  if (!escrow.base_capture_id) await captureBase(sessionId);

  const result = session.result;
  const avg = await tutorAverageGain(session.tutor_id, sessionId);
  // Without a baseline nothing was measured, so both parts use the tutor's average gain.
  const pre = result?.pre_score ?? null;
  const split = computeSplit({
    priceCents: session.price_cents,
    preScore: pre ?? 0,
    postScore: pre === null ? null : (result?.post_score ?? null),
    retentionScore: pre === null ? null : (result?.retention_score ?? null),
    tutorAverageGain: avg,
  });
  // An admin resolving an appeal can set the total tutor pay; it never goes below the base.
  const override = result?.override_tutor_pay_cents ?? null;
  const tutorPayCents = Math.min(session.price_cents, Math.max(split.baseCents, override ?? split.tutorPayCents));
  const bonusCents = tutorPayCents - split.baseCents;
  const returnedCents = session.price_cents - tutorPayCents;

  const current = await db.escrow.findUniqueOrThrow({ where: { session_id: sessionId } });
  let state: EscrowState;
  let bonusCaptureId: string | null = null;
  if (bonusCents > 0) {
    const { capture } = await captureEscrow(current, {
      amountCents: bonusCents,
      finalCapture: true,
      key: `session-${sessionId}-bonus`,
      holdCents: session.price_cents - split.baseCents,
      save: saveEscrow(sessionId),
    });
    bonusCaptureId = capture.id;
    state = 'settled';
  } else {
    await voidAuthorization(current.authorization_id, `session-${sessionId}-void`);
    state = 'returned';
  }

  await db.$transaction([
    db.escrow.update({
      where: { session_id: sessionId },
      data: { state, bonus_capture_id: bonusCaptureId, returned_cents: returnedCents },
    }),
    db.result.upsert({
      where: { session_id: sessionId },
      create: {
        session_id: sessionId,
        pre_score: pre,
        gain_quiz: split.gainQuiz,
        gain_retention: split.gainRetention,
        tutor_pay_cents: tutorPayCents,
      },
      update: { gain_quiz: split.gainQuiz, gain_retention: split.gainRetention, tutor_pay_cents: tutorPayCents },
    }),
    // Transcripts are deleted once the retention quiz is graded and the session settles.
    db.session.update({ where: { id: sessionId }, data: { status: 'settled', transcript: null } }),
  ]);

  const payoutId = await payTutor(sessionId, 'bonus', bonusCents);
  const settled = await db.escrow.update({ where: { session_id: sessionId }, data: { bonus_payout_id: payoutId } });
  await notifySettled(sessionId);
  return settled;
}

/**
 * A booking was cancelled before it started (lib/cancellation.ts). Usually the whole hold is
 * voided, so nothing is charged. A late cancellation by the family captures half for the tutor,
 * and that final capture releases the rest. Safe to repeat: both PayPal calls are idempotent,
 * and a hold PayPal already voided or let expire needs nothing more.
 */
export async function cancelHold(sessionId: string) {
  const escrow = await db.escrow.findUnique({ where: { session_id: sessionId }, include: { session: true } });
  // An unpaid booking has no hold to release.
  if (!escrow || escrow.state === 'cancelled') return escrow;
  if (escrow.base_capture_id) throw new Error(`Session ${sessionId} was already paid out, so its hold can't be voided`);
  const priceCents = escrow.session.price_cents;

  const feeCents = cancellationFeeCents(escrow.session);
  if (feeCents > 0) {
    const { capture } = await captureEscrow(escrow, {
      amountCents: feeCents,
      finalCapture: true,
      key: `session-${sessionId}-late-cancel`,
      holdCents: priceCents,
      save: saveEscrow(sessionId),
      noteToPayer: 'Late cancellation: half the session price goes to the tutor.',
    });
    await db.escrow.update({
      where: { session_id: sessionId },
      data: { state: 'cancelled', base_capture_id: capture.id, returned_cents: priceCents - feeCents },
    });
    const payoutId = await payTutor(sessionId, 'late-cancel', feeCents);
    return db.escrow.update({ where: { session_id: sessionId }, data: { base_payout_id: payoutId } });
  }

  const auth = await getAuthorization(escrow.authorization_id);
  if (auth.status !== 'VOIDED' && auth.status !== 'EXPIRED') {
    await voidAuthorization(escrow.authorization_id, `session-${sessionId}-cancel`);
  }
  return db.escrow.update({
    where: { session_id: sessionId },
    data: { state: 'cancelled', returned_cents: priceCents },
  });
}

/** Where an escrow belongs once an appeal on it is resolved. */
export async function restingState(sessionId: string): Promise<EscrowState> {
  const escrow = await db.escrow.findUniqueOrThrow({ where: { session_id: sessionId } });
  if (escrow.state === 'settled' || escrow.state === 'returned' || escrow.state === 'cancelled') return escrow.state;
  if (!escrow.base_capture_id) return 'held';
  const postGraded = await db.quiz.count({ where: { session_id: sessionId, kind: 'post', score: { not: null } } });
  return postGraded ? 'awaiting_retention' : 'base_paid';
}
