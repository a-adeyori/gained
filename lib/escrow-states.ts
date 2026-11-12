// The seven escrow states, with the same label and colour on every screen. Safe for the browser.

export type EscrowStateKey = 'held' | 'base_paid' | 'awaiting_retention' | 'settled' | 'returned' | 'in_appeal' | 'cancelled';

export const ESCROW_STATES: Record<
  EscrowStateKey,
  { label: string; color: string; outline?: boolean; explain: string }
> = {
  held: {
    label: 'Held',
    color: 'var(--state-held)',
    explain: 'Your payment is held, not charged. Nothing moves until the session happens.',
  },
  base_paid: {
    label: 'Base paid',
    color: 'var(--state-base)',
    explain: 'The guaranteed base went to the tutor. The rest is still held.',
  },
  awaiting_retention: {
    label: 'Awaiting retention quiz',
    color: 'var(--state-awaiting)',
    explain: 'A short check-in quiz goes out 48 hours after the session. The bonus depends on it.',
  },
  settled: {
    label: 'Settled',
    color: 'var(--state-settled)',
    explain: 'Final. The tutor was paid for the learning measured, and the rest came back to you.',
  },
  returned: {
    label: 'Returned',
    color: 'var(--state-returned)',
    explain: 'No bonus was earned, so everything above the base came back to you.',
  },
  in_appeal: {
    label: 'In appeal',
    color: 'var(--state-appeal)',
    outline: true,
    explain: 'Someone disputed a grade. The final payment waits until an admin reviews it.',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--state-held)',
    outline: true,
    explain: 'Cancelled before the session. The hold was released, apart from half the price if it was a late cancellation.',
  },
};

/**
 * "Awaiting retention quiz" stays the escrow state until settlement, which also waits for the
 * 72-hour appeal window. Once the check-in is done (taken, or closed unanswered), screens show
 * this instead, so families aren't told to wait for a quiz that's already over.
 */
export const FINALISING = {
  label: 'Finalising',
  explain: 'The 48-hour check-in is done. The bonus, and anything coming back to you, is settled once the appeal window closes.',
};

/** Whether a session's 48-hour check-in is over: taken, or closed without an answer. */
export const checkInDone = (retention: { completed_at: Date | null; closes_at: Date | null } | undefined, now = new Date()) =>
  !!retention && (retention.completed_at !== null || (retention.closes_at !== null && retention.closes_at <= now));

/** Bryntum and AG Studio need plain colours, not CSS variables (light-mode values). */
export const ESCROW_STATE_HEX: Record<EscrowStateKey, string> = {
  held: '#8a877f',
  base_paid: '#2f6fde',
  awaiting_retention: '#c98512',
  settled: '#0f9d58',
  returned: '#8b7cf0',
  in_appeal: '#d93a30',
  cancelled: '#8a877f',
};

export const formatUsd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
