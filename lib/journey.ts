// Where a session is in its journey, and whose turn it is. Pure functions (no database), so the
// home screens, the session page and the tests all tell the same story.
//
// Booked → Warm-up → Session → Quiz → Check-in → Paid

export const STAGES = ['Booked', 'Warm-up', 'Session', 'Quiz', 'Check-in', 'Paid'] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = 'done' | 'skipped' | 'current' | 'upcoming';

type QuizRow = { id: string; kind: 'baseline' | 'post' | 'retention'; sent_at: Date | null; completed_at: Date | null; closes_at: Date | null };

export type JourneySession = {
  id: string;
  status: string;
  start_at: Date;
  ended_at: Date | null;
  tutor_id: string;
  student_id: string;
  payer_id: string;
  topics_json: unknown;
  topics_confirmed_at: Date | null;
  tutor_confirmed_at: Date | null;
  family_confirmed_at: Date | null;
  escrow: { state: string } | null;
  quizzes: QuizRow[];
  student: { name: string };
  tutor: { name: string };
};

/**
 * What the viewer should do now. `quizId` actions need a signed link, built by the page.
 * A wait's `detail` may contain AT, where the card shows `at` in the viewer's own time zone
 * (the server can't format it: it doesn't know the viewer's zone).
 */
export type NextStep =
  | { kind: 'action'; title: string; detail: string; cta: string; href: string; quizId?: string }
  | { kind: 'wait'; title: string; detail: string; at?: string };

export const AT = '{at}';

const RETENTION_DELAY_MS = 48 * 3600_000;
const first = (name: string) => name.split(' ')[0];

const isOpen = (q: QuizRow | undefined, now: Date) =>
  Boolean(q && q.sent_at && !q.completed_at && (!q.closes_at || q.closes_at > now));

export function stageOf(s: JourneySession): Stage {
  const quiz = (k: QuizRow['kind']) => s.quizzes.find((q) => q.kind === k);
  const state = s.escrow?.state;
  if (state === 'settled' || state === 'returned') return 'Paid';
  if (!s.escrow) return 'Booked';
  if (!s.ended_at) return quiz('baseline')?.completed_at ? 'Session' : 'Warm-up';
  if (!s.topics_confirmed_at) return 'Session';
  if (!quiz('post')?.completed_at) return 'Quiz';
  return 'Check-in';
}

export function stageStatuses(s: JourneySession): { stage: Stage; status: StageStatus }[] {
  const current = STAGES.indexOf(stageOf(s));
  const paid = STAGES[current] === 'Paid';
  const baselineDone = Boolean(s.quizzes.find((q) => q.kind === 'baseline')?.completed_at);
  return STAGES.map((stage, i) => ({
    stage,
    status:
      paid || i < current
        ? stage === 'Warm-up' && !baselineDone
          ? 'skipped'
          : 'done'
        : i === current
          ? 'current'
          : 'upcoming',
  }));
}

/** The one thing this viewer should do (or who they are waiting on) for this session. */
export function nextStep(s: JourneySession, viewerId: string, now = new Date()): NextStep | null {
  const isTutor = viewerId === s.tutor_id;
  const isStudent = viewerId === s.student_id;
  const isPayer = viewerId === s.payer_id;
  const student = isStudent ? 'you' : first(s.student.name);
  const tutor = first(s.tutor.name);
  const quiz = (k: QuizRow['kind']) => s.quizzes.find((q) => q.kind === k);
  const page = `/sessions/${s.id}`;
  const state = s.escrow?.state;

  if (s.status === 'cancelled') return null;
  if (state === 'settled' || state === 'returned') {
    return { kind: 'action', title: 'Results are in', detail: 'See the scores and where the money went.', cta: 'See results', href: page };
  }
  if (state === 'in_appeal') return { kind: 'wait', title: 'Appeal under review', detail: 'A person is checking the grade before the final payment moves.' };

  // 1. Booked: the payer approves the PayPal hold.
  if (!s.escrow) {
    if (isPayer) return { kind: 'action', title: 'Approve the payment hold', detail: 'PayPal holds the price. Nothing is charged until after the session.', cta: 'Approve in PayPal', href: `${page}/checkout` };
    return { kind: 'wait', title: 'Waiting for the payment hold', detail: 'The session is confirmed once the family approves it in PayPal.' };
  }

  // 2–3. Before and during the session.
  if (!s.ended_at) {
    const baseline = quiz('baseline');
    if (isStudent && isOpen(baseline, now)) {
      return { kind: 'action', title: 'Take your warm-up quiz', detail: '5 quick questions so your progress can be measured. No time limit.', cta: 'Start warm-up', href: page, quizId: baseline!.id };
    }
    if (isTutor) {
      const soon = s.start_at.getTime() - now.getTime() < 15 * 60_000;
      return soon
        ? { kind: 'action', title: `Start your session with ${student}`, detail: 'Open the session room, write what you taught, and tap End when you’re done.', cta: 'Open session room', href: `${page}/live` }
        : { kind: 'wait', title: `Session with ${student}`, detail: `Opens ${AT}. ${baseline?.completed_at ? `${student} finished the warm-up.` : `${student} hasn’t done the warm-up yet.`}`, at: s.start_at.toISOString() };
    }
    if (isPayer && !isStudent && isOpen(baseline, now)) {
      return { kind: 'action', title: `${student} has a warm-up quiz`, detail: 'Send them the link so their starting point is measured.', cta: 'Get the link', href: page };
    }
    return { kind: 'wait', title: `Session with ${isTutor ? student : tutor}`, detail: `${AT}. Your tutor runs it from the session room.`, at: s.start_at.toISOString() };
  }

  // After the session: the tutor confirms what was covered, so the quiz can be written.
  if (!s.topics_confirmed_at) {
    if (isTutor && s.topics_json) return { kind: 'action', title: 'Confirm what you covered', detail: 'The quiz is written from this topic list.', cta: 'Confirm topics', href: `${page}/live` };
    if (isTutor) return { kind: 'wait', title: 'Building the topic list', detail: 'Usually a few minutes after the session ends.' };
    return { kind: 'wait', title: `Waiting for ${tutor} to confirm topics`, detail: 'The quiz is written from what was actually covered.' };
  }

  // The family confirms the session happened (releases the 80% base).
  if (isPayer && s.tutor_confirmed_at && !s.family_confirmed_at) {
    return { kind: 'action', title: 'Did the session happen?', detail: `Confirming pays ${tutor} the 80% base. It happens automatically after 24 hours.`, cta: 'Confirm', href: page };
  }

  // 4. The post-session quiz.
  const post = quiz('post');
  if (!post?.completed_at) {
    if (isStudent && isOpen(post, now)) return { kind: 'action', title: 'Take your quiz', detail: 'Fresh questions on what you just covered. No time limit.', cta: 'Start quiz', href: page, quizId: post!.id };
    if (!post) return { kind: 'wait', title: 'Writing the quiz', detail: 'Built from the confirmed topics. Ready in a few minutes.' };
    return { kind: 'wait', title: `Waiting for ${student} to take the quiz`, detail: 'The result decides the learning bonus.' };
  }

  // 5. The 48-hour check-in.
  const retention = quiz('retention');
  if (isStudent && isOpen(retention, now)) {
    return { kind: 'action', title: 'Take your 48-hour check-in', detail: 'One last short quiz to show what stuck. Open for 12 hours.', cta: 'Start check-in', href: page, quizId: retention!.id };
  }
  if (!retention?.sent_at) {
    const opens = new Date(s.ended_at.getTime() + RETENTION_DELAY_MS);
    return { kind: 'wait', title: 'Check-in quiz coming', detail: `Opens ${AT}, to show what stuck.`, at: opens.toISOString() };
  }
  return { kind: 'wait', title: 'Settling the payment', detail: 'The bonus is paid and the rest comes back automatically.' };
}
