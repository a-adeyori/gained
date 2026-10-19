// Who may open a quiz, and whether it's open right now. Server-only.

import { currentUser } from './auth';
import type { Question } from './claude';
import { db } from './db';
import { checkQuizToken } from './signing';

/** Baselines stay open until 15 minutes into the session. */
const BASELINE_GRACE_MS = 15 * 60_000;

export async function loadQuiz(quizId: string, token: string | undefined) {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { session: { include: { tutor: true, student: true } } } });
  if (!quiz) return null;
  if (!checkQuizToken(quizId, token)) {
    // A signed-in student (or an adult student who is their own payer) doesn't need the link token.
    const user = await currentUser();
    if (!user || user.id !== quiz.session.student_id) return null;
  }
  return quiz;
}

export type QuizRow = NonNullable<Awaited<ReturnType<typeof loadQuiz>>>;

export function quizWindow(quiz: QuizRow, now = new Date()): 'open' | 'not-sent' | 'closed' | 'done' {
  if (quiz.completed_at) return 'done';
  if (!quiz.sent_at) return 'not-sent';
  if (quiz.closes_at && now >= quiz.closes_at) return 'closed';
  if (quiz.kind === 'baseline' && now.getTime() > quiz.session.start_at.getTime() + BASELINE_GRACE_MS) return 'closed';
  if (['settling', 'settled'].includes(quiz.session.status)) return 'closed';
  return 'open';
}

/** What the student's browser gets: never the answer key. */
export type PublicQuestion = Pick<Question, 'id' | 'type' | 'prompt' | 'choices' | 'unit'>;

export const publicQuestions = (quiz: QuizRow): PublicQuestion[] =>
  (quiz.questions_json as Question[]).map(({ id, type, prompt, choices, unit }) => ({ id, type, prompt, choices, unit }));
