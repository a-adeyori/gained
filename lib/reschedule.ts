// Moving a booked session to a new time (issue #43). Pure, so it's tested; the action is
// rescheduleSession in app/(app)/sessions/[id]/actions.ts. Safe for the browser.
//
//  - The tutor or the payer (or an admin) can move a session that hasn't started, or one nobody
//    started (a no-show) until 24 hours after its scheduled end. A student who didn't pay asks
//    the payer.
//  - The new time follows the booking rules (inside the tutor's open time, free, in the future),
//    keeps the same length and price, and keeps the same PayPal hold, so it must fall within the
//    hold's life.
//  - A family that moves a session inside the late-cancellation window keeps that window's
//    terms, so moving isn't a way around the late fee.

import { freeCancelUntil, type CancelSession, type CancelWho } from './cancellation';
import { findContainingRange, isBlocking, openStarts, overlaps, type SessionSlot, type TimeRange } from './booking';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A session nobody started can be moved until this long after its scheduled end. */
export const RESCHEDULE_AFTER_END_HOURS = 24;
/** New times are offered this far ahead, like booking. */
export const RESCHEDULE_WINDOW_DAYS = 14;
/**
 * PayPal holds last 29 days, and the final capture comes about 3 days after the session, so a
 * moved session must start within this many days of the hold being placed.
 */
export const HOLD_LIFE_DAYS = 21;

export type RescheduleSession = CancelSession & { end_at: Date };

export type RescheduleCheck = { ok: true; as: CancelWho } | { ok: false; reason: string; hidden?: boolean };

export function canReschedule(session: RescheduleSession, user: { id: string; role: string }, now = new Date()): RescheduleCheck {
  const isTutor = user.id === session.tutor_id;
  const isPayer = user.id === session.payer_id;
  const isAdmin = user.role === 'admin';
  if (!isTutor && !isPayer && !isAdmin) {
    return user.id === session.student_id
      ? { ok: false, reason: 'Only the person who paid can move or cancel it. Ask them if you can’t make it.' }
      : { ok: false, reason: 'You can’t move this session.', hidden: true };
  }
  // Started, ended, settled or cancelled sessions stay where they are.
  if (session.status !== 'booked') return { ok: false, reason: 'This session can’t be moved now.', hidden: true };
  if (now.getTime() >= session.end_at.getTime() + RESCHEDULE_AFTER_END_HOURS * HOUR) {
    return { ok: false, reason: 'It’s too long since this session was due to move it.', hidden: true };
  }
  return { ok: true, as: isTutor ? 'tutor' : isPayer ? 'family' : 'admin' };
}

/** The latest a moved session can start: the booking window, and the life of the hold. */
export const latestNewStart = (authorizedAt: Date, now: Date) =>
  new Date(Math.min(now.getTime() + RESCHEDULE_WINDOW_DAYS * DAY, authorizedAt.getTime() + HOLD_LIFE_DAYS * DAY));

const minutesOf = (s: TimeRange) => Math.round((s.end_at.getTime() - s.start_at.getTime()) / 60_000);

/** Every start time the session could move to. `others` are the tutor's other sessions. */
export function rescheduleOptions(
  session: RescheduleSession & { id: string },
  availability: TimeRange[],
  others: SessionSlot[],
  authorizedAt: Date,
  now: Date,
): Date[] {
  const latest = latestNewStart(authorizedAt, now);
  const minutes = minutesOf(session);
  const rest = others.filter((s) => s.id !== session.id);
  return availability
    .flatMap((range) => openStarts(range, minutes, rest, now))
    .filter((t) => t <= latest && t.getTime() !== session.start_at.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Every check the new time must pass on the server. Returns the new end time. */
export function checkNewTime(
  session: RescheduleSession & { id: string },
  newStart: Date,
  ctx: { availability: TimeRange[]; others: SessionSlot[]; authorizedAt: Date; now: Date },
): Result<{ endAt: Date }> {
  if (Number.isNaN(newStart.getTime())) return { ok: false, error: 'Pick a new time.' };
  if (newStart <= ctx.now) return { ok: false, error: 'That time has already passed. Pick a later one.' };
  if (newStart.getTime() === session.start_at.getTime()) return { ok: false, error: 'That’s the time it’s already at. Pick a different one.' };
  if (newStart > latestNewStart(ctx.authorizedAt, ctx.now)) {
    return { ok: false, error: 'That’s too far ahead for this booking’s payment hold. Pick an earlier time, or cancel and book again.' };
  }
  const slot = { start_at: newStart, end_at: new Date(newStart.getTime() + minutesOf(session) * 60_000) };
  if (!findContainingRange(ctx.availability, slot)) return { ok: false, error: 'That isn’t inside the tutor’s open time any more. Pick another.' };
  if (ctx.others.some((s) => s.id !== session.id && isBlocking(s, ctx.now) && overlaps(s, slot))) {
    return { ok: false, error: 'Someone just booked that time. Pick another.' };
  }
  return { ok: true, endAt: slot.end_at };
}

/**
 * The free-cancellation deadline to store after a move (null: the usual 24 hours before).
 *  - The tutor or an admin moved it: the family didn't choose the new time, so they can cancel
 *    free right up to it.
 *  - The family moved it inside the late window (before the start): they keep the old deadline,
 *    which has passed, so cancelling later is still late.
 *  - The family moved it earlier, or after a no-show: the usual rule for the new time.
 */
export function freeCancelAfterMove(session: RescheduleSession, as: CancelWho, now: Date, newStart: Date): Date | null {
  if (as !== 'family') return newStart;
  const deadline = freeCancelUntil(session);
  return now >= deadline && now < session.start_at ? deadline : null;
}
