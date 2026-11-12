// Who may cancel a booking, and on what terms (issue #43). Pure, so it's tested; the action is
// cancelSession in app/(app)/sessions/[id]/actions.ts and the PayPal void is cancelSessionStep in
// lib/pipeline.ts. Safe for the browser.
//
//  - The payer cancels free until 24 hours before the start. A student can cancel only a session
//    they paid for themselves; otherwise they ask the payer.
//  - The tutor and admins can cancel any time before the start, and the family pays nothing.
//  - Nobody cancels once the session has started; problems go through an appeal.

/** Families cancel free until this many hours before the start. */
export const FREE_CANCEL_HOURS = 24;

const HOUR = 3_600_000;

export type CancelSession = {
  status: string;
  start_at: Date;
  tutor_id: string;
  payer_id: string;
  student_id: string;
};

export type CancelWho = 'family' | 'tutor' | 'admin';

export type CancelCheck =
  | { ok: true; as: CancelWho }
  | { ok: false; reason: string; hidden?: boolean };

/** When free cancellation ends for the family. */
export const freeCancelUntil = (startAt: Date) => new Date(startAt.getTime() - FREE_CANCEL_HOURS * HOUR);

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
  if (isAdmin && !isTutor && !isPayer) return { ok: true, as: 'admin' };
  if (isTutor) return { ok: true, as: 'tutor' };
  if (now >= freeCancelUntil(session.start_at)) {
    return { ok: false, reason: `Free cancellation ends ${FREE_CANCEL_HOURS} hours before the start, so this session can no longer be cancelled here.` };
  }
  return { ok: true, as: 'family' };
}

/** Longest reason kept with a cancellation. */
export const MAX_CANCEL_REASON = 500;
