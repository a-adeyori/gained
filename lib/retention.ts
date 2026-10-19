// Retention quiz timing, decided by the cron job every 15 minutes: the quiz goes out 48 hours
// after the session ends and closes 12 hours after it is sent. A quiz that closes unanswered
// is scored at the tutor's rolling average gain (computeSplit with retentionScore: null).

const HOUR = 3_600_000;
export const RETENTION_DELAY_HOURS = 48;
export const RETENTION_WINDOW_HOURS = 12;

export const retentionSendAt = (sessionEndedAt: Date) => new Date(sessionEndedAt.getTime() + RETENTION_DELAY_HOURS * HOUR);
export const retentionClosesAt = (sentAt: Date) => new Date(sentAt.getTime() + RETENTION_WINDOW_HOURS * HOUR);

export type RetentionQuizTiming = {
  sessionEndedAt: Date;
  sent_at: Date | null;
  closes_at: Date | null;
  completed_at: Date | null;
};

/**
 * What the cron job should do with a session's retention quiz right now:
 * - `send`: due and not yet sent; set sent_at = now and closes_at = retentionClosesAt(now).
 * - `settle-completed`: answered; grade it and trigger settleSession.
 * - `settle-expired`: closed unanswered; trigger settleSession with the rolling-average fallback.
 * - `wait`: nothing to do yet.
 */
export function retentionAction(
  quiz: RetentionQuizTiming,
  now: Date,
): 'send' | 'settle-completed' | 'settle-expired' | 'wait' {
  if (quiz.completed_at) return 'settle-completed';
  if (!quiz.sent_at) return now >= retentionSendAt(quiz.sessionEndedAt) ? 'send' : 'wait';
  const closesAt = quiz.closes_at ?? retentionClosesAt(quiz.sent_at);
  return now >= closesAt ? 'settle-expired' : 'wait';
}

// --- Settlement timing ----------------------------------------------------------------

/** Either side can appeal for 72 hours after the session; the final capture waits for it. */
export const APPEAL_WINDOW_HOURS = 72;
/** If the family never taps "It happened", the session counts as confirmed after 24 hours. */
export const AUTO_CONFIRM_HOURS = 24;

export const appealWindowClosesAt = (sessionEndedAt: Date) =>
  new Date(sessionEndedAt.getTime() + APPEAL_WINDOW_HOURS * HOUR);

/**
 * Whether the cron job should trigger settleSession: the base is paid, the retention quiz is
 * graded or closed (or was never written), the appeal window has passed, and no appeal is open.
 */
export function readyToSettle(input: {
  sessionEndedAt: Date;
  escrowState: string;
  retention: (RetentionQuizTiming & { graded: boolean }) | null;
  openAppeals: number;
  now: Date;
}): boolean {
  if (!['base_paid', 'awaiting_retention'].includes(input.escrowState)) return false;
  if (input.openAppeals > 0) return false;
  if (input.now < appealWindowClosesAt(input.sessionEndedAt)) return false;
  if (!input.retention) return true;
  const action = retentionAction(input.retention, input.now);
  if (action === 'settle-completed') return input.retention.graded;
  return action === 'settle-expired';
}
