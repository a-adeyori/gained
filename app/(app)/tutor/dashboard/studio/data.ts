// AG Studio's data model for the tutor dashboard: one lazy data source whose getData reads the
// signed-in tutor's rows from /api/tutor/data (lib/studio-data.ts builds them), three related
// tables, a calendar and a few calculated measures. Names and descriptions are written for the
// AI assistant as much as for people: it reads them to decide which field answers a question.

import type {
  AgAsyncTableDefinition,
  AgDataSourcesDefinition,
  AgExpressionFieldDefinition,
  AgFieldDefinition,
  AgFormat,
  AgRelationDefinition,
} from 'ag-studio';
import { ESCROW_STATES } from '@/lib/escrow-states';
import type { TutorStudioData } from '@/lib/studio-data';

const CALENDAR_ID = 'calendar';

// [id, name, format, description, hide?]
type FieldSpec = [id: string, name: string, format: AgFormat, description: string, hide?: boolean];

const fields = (specs: FieldSpec[]): AgFieldDefinition[] =>
  specs.map(([id, name, format, description, hide]) => ({ id, name, format, description, ...(hide && { hide }) }));

const manyToOne = (id: string, source: string, target: string): AgRelationDefinition => {
  const [sourceTable, sourceField] = source.split('.');
  const [targetTable, targetField] = target.split('.');
  return {
    id,
    source: { tableId: sourceTable, fieldId: sourceField },
    target: { tableId: targetTable, fieldId: targetField },
    type: 'many-to-one',
  };
};

const onCalendar = (tableId: string, fieldId: string): AgRelationDefinition => ({
  id: `${tableId}-${fieldId}-calendar`,
  source: { tableId, fieldId },
  target: { calendarId: CALENDAR_ID },
});

const sumOf = (id: string) => ({ id, aggregation: 'sum' as const });

const ratio = (
  id: string,
  name: string,
  description: string,
  numerator: string,
  denominator: string,
): AgExpressionFieldDefinition => ({
  id,
  name,
  description,
  format: 'percentageFormat',
  isMeasure: true,
  expression: { operator: 'divide', inputs: [sumOf(numerator), sumOf(denominator)] },
});

const stateField = (id: string, key: keyof typeof ESCROW_STATES): FieldSpec => [
  id,
  ESCROW_STATES[key].label,
  'integerFormat',
  `1 if this session's escrow is "${ESCROW_STATES[key].label}", otherwise 0. Sum it to count sessions in that state. ${ESCROW_STATES[key].explain}`,
];

// --- Tables -------------------------------------------------------------------------

const TABLES: AgAsyncTableDefinition[] = [
  {
    id: 'sessions',
    name: 'Sessions',
    description:
      'One row per booked tutoring session with a payment hold (the escrow). Scores are quiz percentages out of 100: ' +
      'the baseline before the session, the quiz right after it, and a retention quiz about 48 hours later. ' +
      'Gains are normalized learning gain from 0 to 1: (after - before) / (100 - before). Scores and gains are blank until the quiz is graded.',
    fields: fields([
      ['sessionId', 'Session ID', 'textFormat', 'Unique id of the session.', true],
      ['sessionDate', 'Session Date', 'dateFormat', 'The day the session was scheduled (UTC).'],
      ['startTime', 'Start Time', 'dateTimeFormat', 'When the session was scheduled to start.'],
      ['student', 'Student', 'textFormat', "The student's name."],
      ['subject', 'Subject', 'textFormat', 'The subject the session covered, such as Algebra or Chemistry.'],
      ['durationMinutes', 'Duration (min)', 'integerFormat', 'Scheduled length of the session in minutes.'],
      ['price', 'Price', 'currencyFormat', 'What the family authorized for the session, in USD. Held, not charged, until the session happens.'],
      ['escrowState', 'Escrow State', 'textFormat', `Where the payment is now: one of ${Object.values(ESCROW_STATES).map((s) => `"${s.label}"`).join(', ')}.`],
      ['sessionStatus', 'Session Status', 'textFormat', 'Workflow status: booked, live, ended, topics_confirmed, complete, settled or cancelled.'],
      ['preScore', 'Before Score', 'decimalFormat', 'Baseline quiz score before the session, 0-100.'],
      ['postScore', 'After Score', 'decimalFormat', 'Quiz score right after the session, 0-100.'],
      ['retentionScore', 'Retention Score', 'decimalFormat', 'Score on the retention quiz about 48 hours later, 0-100.'],
      ['scoreChange', 'Score Change (pts)', 'decimalFormat', 'After score minus before score, in percentage points.'],
      ['quizGain', 'Learning Gain', 'percentageFormat', 'Normalized gain from the before score to the after score, 0-1. Average it, never sum it.'],
      ['retentionGain', 'Retention Gain', 'percentageFormat', 'Normalized gain from the before score to the retention score, 0-1. Average it, never sum it.'],
      ['tutorPay', 'Tutor Pay Captured', 'currencyFormat', 'Base plus bonus captured for the tutor so far, in USD, before the platform fee.'],
      ['returnedToFamily', 'Returned to Family', 'currencyFormat', 'What was released back to the family at settlement, in USD.'],
      stateField('stateSettled', 'settled'),
      stateField('stateBasePaid', 'base_paid'),
      stateField('stateAwaitingRetention', 'awaiting_retention'),
      stateField('stateReturned', 'returned'),
      stateField('stateHeld', 'held'),
      stateField('stateInAppeal', 'in_appeal'),
    ]),
  },
  {
    id: 'earnings',
    name: 'Earnings',
    description:
      'One row per session where money was captured for the tutor. The base is 80% of the price, captured after the session; ' +
      'the bonus (up to 20%) is captured at settlement and depends on measured learning gain. The platform keeps a 10% fee ' +
      'of everything captured; net earnings are what the tutor receives through PayPal Payouts.',
    fields: fields([
      ['sessionId', 'Session ID', 'textFormat', 'The session these earnings came from.', true],
      ['earningDate', 'Earning Date', 'dateFormat', 'The day of the session the money was earned in (UTC).'],
      ['baseCaptured', 'Base Captured', 'currencyFormat', 'Guaranteed base captured for the tutor, in USD, before the fee.'],
      ['bonusCaptured', 'Bonus Captured', 'currencyFormat', 'Learning-gain bonus captured for the tutor, in USD, before the fee.'],
      ['totalCaptured', 'Total Captured', 'currencyFormat', 'Base plus bonus captured, in USD, before the fee.'],
      ['platformFee', 'Platform Fee', 'currencyFormat', "Gained's 10% fee on what was captured, in USD."],
      ['netEarnings', 'Net Earnings', 'currencyFormat', 'What the tutor earns after the platform fee, in USD. Use this for "how much did I earn after fees".'],
      ['netPaidOut', 'Net Paid Out', 'currencyFormat', 'The part of net earnings already sent to the tutor through PayPal Payouts, in USD.'],
      ['awaitingPayout', 'Awaiting Payout', 'currencyFormat', 'Net earnings not yet paid out, in USD.'],
    ]),
  },
  {
    id: 'topicGains',
    name: 'Topic Gains',
    description:
      'One row per session and topic covered in it (topics are extracted from the session and confirmed by the tutor). ' +
      "Each row carries its session's learning gain, so averaging a gain by topic shows which topics students gain most on. " +
      'Join to Sessions for the student and subject.',
    fields: fields([
      ['topicGainId', 'Topic Row ID', 'textFormat', 'Unique id of the session and topic pair.', true],
      ['sessionId', 'Session ID', 'textFormat', 'The session the topic was covered in.', true],
      ['sessionDate', 'Topic Session Date', 'dateFormat', 'The day of the session the topic was covered in (UTC).'],
      ['topic', 'Topic', 'textFormat', 'A topic covered in the session, such as "Solving quadratic equations".'],
      ['quizGain', 'Topic Learning Gain', 'percentageFormat', "The session's normalized learning gain, 0-1. Average it, never sum it."],
      ['retentionGain', 'Topic Retention Gain', 'percentageFormat', "The session's normalized retention gain, 0-1. Average it, never sum it."],
      ['scoreChange', 'Topic Score Change (pts)', 'decimalFormat', "The session's after score minus before score, in points."],
    ]),
  },
];

type TableId = 'sessions' | 'earnings' | 'topicGains';

/** Fetches all three tables once per dashboard and serves each getData call from that. */
function createLoader() {
  let pending: Promise<TutorStudioData> | undefined;
  return () =>
    (pending ??= fetch('/api/tutor/data', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) {
        pending = undefined;
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.message ?? `Couldn't load your sessions (HTTP ${response.status}).`);
      }
      return response.json() as Promise<TutorStudioData>;
    }));
}

/** `from` and `to` are the first and last session dates, for the calendar's range. */
export function buildStudioData({ from, to }: { from: string; to: string }): AgDataSourcesDefinition {
  const load = createLoader();
  return {
    description:
      "A tutor's own data on Gained, a tutoring marketplace where families pay for learning, not hours. " +
      'At booking the full price is authorized and held (not charged). After the session the tutor is paid an 80% base; ' +
      'up to 20% more is a bonus tied to measured learning gain on short quizzes; the rest is returned to the family. ' +
      'Money is in USD. Learning gain is the main quality measure: average gains, never sum them. ' +
      'Escrow states always use these labels: ' +
      Object.values(ESCROW_STATES)
        .map((s) => s.label)
        .join(', ') +
      '.',
    sources: [
      {
        id: 'gained',
        name: 'Gained',
        dataShape: 'row',
        tables: TABLES,
        getData: async (tableId) => {
          const data = await load();
          return { data: data[tableId as TableId] ?? [] };
        },
      },
    ],
    relationships: [
      manyToOne('earning-session', 'earnings.sessionId', 'sessions.sessionId'),
      manyToOne('topic-session', 'topicGains.sessionId', 'sessions.sessionId'),
      onCalendar('sessions', 'sessionDate'),
      onCalendar('earnings', 'earningDate'),
      onCalendar('topicGains', 'sessionDate'),
    ],
    calendars: [
      {
        id: CALENDAR_ID,
        label: 'Calendar',
        range: { from: { type: 'date', value: from }, to: { type: 'date', value: to } },
        fragments: ['year', 'quarter', 'month', 'week', 'day', 'dayOfWeek'],
      },
    ],
    expressions: [
      ratio('bonusShare', 'Bonus Share', 'Bonus captured / total captured: how much of the pay came from learning gains.', 'earnings.bonusCaptured', 'earnings.totalCaptured'),
      ratio('returnedShare', 'Returned Share', 'Returned to families / price of the sessions.', 'sessions.returnedToFamily', 'sessions.price'),
      ratio('payoutProgress', 'Paid Out Share', 'Net paid out / net earnings.', 'earnings.netPaidOut', 'earnings.netEarnings'),
    ],
  };
}
