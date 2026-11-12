// Who may cancel a booking, and on what terms (issue #43). Pure, so it's tested; the action is
// cancelSession in app/(app)/sessions/[id]/actions.ts and the money moves in cancelHold
// (lib/escrow.ts). Safe for the browser.
//
//  - The payer cancels free until 24 hours before the start. After that it's a late
//    cancellation: half the price goes to the tutor and the rest of the hold is released.
//    A student can cancel only a session they paid for themselves; otherwise they ask the payer.
//  - The tutor and admins can cancel any time before the start, and the family pays nothing.
//  - Nobody cancels once the session has started; problems go through an appeal.

/** Families cancel free until this many hours before the start. */
export const FREE_CANCEL_HOURS = 24;
/** The share of the price a late cancellation by the family pays the tutor. */
export const LATE_CANCEL_SHARE = 0.5;

const HOUR = 3_600_000;

export type CancelSession = {
  status: string;
  start_at: Date;
  price_cents: number;
  tutor_id: string;
  payer_id: string;
  student_id: string;
  free_cancel_until?: Date | null;
};

export type CancelWho = 'family' | 'tutor' | 'admin';

export type CancelCheck =
  | { ok: true; as: CancelWho; /** What the tutor is paid from the hold; 0 when free. */ feeCents: number }
  | { ok: false; reason: string; hidden?: boolean };

/**
 * When free cancellation ends for the family: 24 hours before the start, unless the family moved
 * the session inside that window, which keeps the original deadline (lib/reschedule.ts).
 */
export const freeCancelUntil = (session: { start_at: Date; free_cancel_until?: Date | null }) =>
  session.free_cancel_until ?? new Date(session.start_at.getTime() - FREE_CANCEL_HOURS * HOUR);

export const lateFeeCents = (priceCents: number) => Math.round(priceCents * LATE_CANCEL_SHARE);

export function canCancel(session: CancelSession, user: { id: string; role: string }, now = new Date()): CancelCheck {
  const isTutor = user.id === session.tutor_id;
  const isPayer = user.id === session.payer_id;
  const isAdmin = user.role === 'admin';
  // Someone with no say over the booking never sees a cancel option.
  if (!isTutor && !isPayer && !isAdmin) {
    return user.id === session.student_id
      ? { ok: false, reason: 'Only the person who paid can cancel. Ask them if you can’t make it.' }
      : { ok: false, reason: 'You can’t cancel this session.', hidden: true };
  }
  if (session.status === 'cancelled') return { ok: false, reason: 'This session is already cancelled.', hidden: true };
  if (session.status !== 'booked' || now >= session.start_at) {
    return { ok: false, reason: 'The session has started, so it can’t be cancelled. If something went wrong, open an appeal afterwards.', hidden: true };
  }
  if (isTutor) return { ok: true, as: 'tutor', feeCents: 0 };
  if (!isPayer) return { ok: true, as: 'admin', feeCents: 0 };
  const late = now >= freeCancelUntil(session);
  return { ok: true, as: 'family', feeCents: late ? lateFeeCents(session.price_cents) : 0 };
}

/**
 * What a cancelled session paid the tutor, from who cancelled and when: the late fee if the
 * payer cancelled within 24 hours of the start, otherwise nothing.
 */
export function cancellationFeeCents(session: {
  start_at: Date;
  price_cents: number;
  tutor_id: string;
  payer_id: string;
  cancelled_at: Date | null;
  cancelled_by_id: string | null;
  free_cancel_until?: Date | null;
}): number {
  const byPayer = session.cancelled_by_id === session.payer_id && session.cancelled_by_id !== session.tutor_id;
  if (!byPayer || !session.cancelled_at) return 0;
  return session.cancelled_at >= freeCancelUntil(session) ? lateFeeCents(session.price_cents) : 0;
}

/** Longest reason kept with a cancellation. */
export const MAX_CANCEL_REASON = 500;
