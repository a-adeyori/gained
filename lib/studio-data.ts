// Rows for the tutor dashboard (AG Studio) and the money math the parent progress page shares.
// Pure functions over already-loaded sessions, with no database access, so the browser can
// import the row types and STATE_COLUMNS. The queries live in app/api/tutor/data/route.ts.

import { ESCROW_STATES, type EscrowStateKey } from './escrow-states';
import { baseCentsFor, tutorNetCents } from './payout';

// --- Money per escrow ---------------------------------------------------------------

type MoneyInput = {
  price_cents: number;
  escrow: {
    state: string;
    base_capture_id: string | null;
    bonus_capture_id: string | null;
    base_payout_id: string | null;
    bonus_payout_id: string | null;
    returned_cents: number | null;
  };
  result: { tutor_pay_cents: number | null } | null;
};

export type EscrowMoney = {
  baseCents: number;
  bonusCents: number;
  /** base + bonus captured from the family's authorization. */
  capturedCents: number;
  /** The platform's cut of what was captured. */
  feeCents: number;
  /** What the tutor receives after the fee, whether or not the payout has gone out yet. */
  netCents: number;
  /** The part of netCents already sent through PayPal Payouts. */
  netPaidOutCents: number;
  /** Released back to the family at settlement. */
  returnedCents: number;
  /** Still held on the family's card: authorized, neither captured nor released. */
  heldCents: number;
};

const FINAL_STATES = new Set(['settled', 'returned']);

/**
 * Money that has actually moved for one session, derived the same way lib/escrow.ts captures it:
 * the base is 80% of the price once captured, the bonus is the tutor's total pay minus the base,
 * and each capture is paid out separately after the platform fee.
 */
export function escrowMoney({ price_cents, escrow, result }: MoneyInput): EscrowMoney {
  const baseCents = escrow.base_capture_id ? baseCentsFor(price_cents) : 0;
  const tutorPay = result?.tutor_pay_cents ?? null;
  const bonusCents = escrow.bonus_capture_id && tutorPay !== null ? Math.max(0, tutorPay - baseCents) : 0;
  const capturedCents = baseCents + bonusCents;
  const netCents = tutorNetCents(baseCents) + tutorNetCents(bonusCents);
  const netPaidOutCents =
    (escrow.base_payout_id ? tutorNetCents(baseCents) : 0) + (escrow.bonus_payout_id ? tutorNetCents(bonusCents) : 0);
  const final = FINAL_STATES.has(escrow.state);
  return {
    baseCents,
    bonusCents,
    capturedCents,
    feeCents: capturedCents - netCents,
    netCents,
    netPaidOutCents,
    returnedCents: escrow.returned_cents ?? 0,
    heldCents: final ? 0 : Math.max(0, price_cents - capturedCents),
  };
}

/** Topic names from Session.topics_json, tolerating a missing or malformed list. */
export function topicNames(topicsJson: unknown): string[] {
  const topics = (topicsJson as { topics?: unknown } | null)?.topics;
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => (t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string' ? (t as { name: string }).name.trim() : ''))
    .filter(Boolean);
}

// --- Tutor dashboard rows -----------------------------------------------------------

// Money is in dollars and scores 0-100, gains 0-1, because that is what AG Studio's currency and
// percentage formats expect. Dates are 'YYYY-MM-DD' strings in UTC.

/** Cancelled bookings never happened, so the dashboard leaves them out. */
type ChartedState = Exclude<EscrowStateKey, 'cancelled'>;

/** One 0/1 column per escrow state, so a chart can plot all six as series in a fixed order. */
export const STATE_COLUMNS = {
  settled: 'stateSettled',
  base_paid: 'stateBasePaid',
  awaiting_retention: 'stateAwaitingRetention',
  returned: 'stateReturned',
  held: 'stateHeld',
  in_appeal: 'stateInAppeal',
} as const satisfies Record<ChartedState, string>;

type StateColumns = Record<(typeof STATE_COLUMNS)[ChartedState], 0 | 1>;

export type SessionRow = StateColumns & {
  sessionId: string;
  sessionDate: string;
  startTime: string;
  student: string;
  subject: string;
  durationMinutes: number;
  price: number;
  escrowState: string;
  sessionStatus: string;
  preScore: number | null;
  postScore: number | null;
  retentionScore: number | null;
  scoreChange: number | null;
  quizGain: number | null;
  retentionGain: number | null;
  tutorPay: number;
  returnedToFamily: number;
};

export type EarningRow = {
  sessionId: string;
  earningDate: string;
  baseCaptured: number;
  bonusCaptured: number;
  totalCaptured: number;
  platformFee: number;
  netEarnings: number;
  netPaidOut: number;
  awaitingPayout: number;
};

export type TopicGainRow = {
  topicGainId: string;
  sessionId: string;
  sessionDate: string;
  topic: string;
  quizGain: number | null;
  retentionGain: number | null;
  scoreChange: number | null;
};

export type TutorStudioData = {
  asOf: string;
  sessions: SessionRow[];
  earnings: EarningRow[];
  topicGains: TopicGainRow[];
};

const dollars = (cents: number) => cents / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** The shape buildTutorStudioData reads: a session with its student, escrow and result. */
export type TutorSessionInput = {
  id: string;
  start_at: Date;
  end_at: Date;
  price_cents: number;
  subject: string;
  status: string;
  topics_json: unknown;
  student: { name: string };
  escrow: MoneyInput['escrow'] | null;
  result: {
    pre_score: number | null;
    post_score: number | null;
    retention_score: number | null;
    gain_quiz: number | null;
    gain_retention: number | null;
    tutor_pay_cents: number | null;
  } | null;
};

/** Everything the dashboard shows, from one tutor's sessions (oldest first). */
export function buildTutorStudioData(sessions: TutorSessionInput[], now = new Date()): TutorStudioData {
  const out: TutorStudioData = { asOf: now.toISOString(), sessions: [], earnings: [], topicGains: [] };
  for (const s of sessions) {
    if (!s.escrow || s.escrow.state === 'cancelled') continue;
    const state = s.escrow.state as ChartedState;
    const money = escrowMoney({ price_cents: s.price_cents, escrow: s.escrow, result: s.result });
    const r = s.result;
    const scoreChange = r?.pre_score != null && r.post_score != null ? round1(r.post_score - r.pre_score) : null;
    const date = day(s.start_at);

    const stateColumns = Object.fromEntries(
      Object.entries(STATE_COLUMNS).map(([key, column]) => [column, key === state ? 1 : 0]),
    ) as StateColumns;

    out.sessions.push({
      ...stateColumns,
      sessionId: s.id,
      sessionDate: date,
      startTime: s.start_at.toISOString(),
      student: s.student.name,
      subject: s.subject,
      durationMinutes: Math.round((s.end_at.getTime() - s.start_at.getTime()) / 60_000),
      price: dollars(s.price_cents),
      escrowState: ESCROW_STATES[state]?.label ?? state,
      sessionStatus: s.status,
      preScore: round1(r?.pre_score ?? null),
      postScore: round1(r?.post_score ?? null),
      retentionScore: round1(r?.retention_score ?? null),
      scoreChange,
      quizGain: r?.gain_quiz ?? null,
      retentionGain: r?.gain_retention ?? null,
      tutorPay: dollars(money.capturedCents),
      returnedToFamily: dollars(money.returnedCents),
    });

    if (money.capturedCents > 0) {
      out.earnings.push({
        sessionId: s.id,
        earningDate: date,
        baseCaptured: dollars(money.baseCents),
        bonusCaptured: dollars(money.bonusCents),
        totalCaptured: dollars(money.capturedCents),
        platformFee: dollars(money.feeCents),
        netEarnings: dollars(money.netCents),
        netPaidOut: dollars(money.netPaidOutCents),
        awaitingPayout: dollars(money.netCents - money.netPaidOutCents),
      });
    }

    for (const [i, topic] of topicNames(s.topics_json).entries()) {
      out.topicGains.push({
        topicGainId: `${s.id}:${i}`,
        sessionId: s.id,
        sessionDate: date,
        topic,
        quizGain: r?.gain_quiz ?? null,
        retentionGain: r?.gain_retention ?? null,
        scoreChange,
      });
    }
  }
  return out;
}
