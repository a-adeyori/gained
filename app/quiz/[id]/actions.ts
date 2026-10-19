'use server';

import type { Question } from '@/lib/claude';
import { db } from '@/lib/db';
import { gradeDeterministic } from '@/lib/grading';
import { startJob } from '@/lib/jobs';
import { loadQuiz, quizWindow } from '@/lib/quiz-access';

export type Feedback =
  | { kind: 'saved' }
  | { kind: 'graded'; correct: boolean; explanation: string }
  | { kind: 'error'; message: string };

/**
 * Saves one answer. Answers lock once given. Post-session and retention questions get instant
 * feedback; baseline answers stay hidden so the baseline doesn't teach before the session.
 */
export async function answerQuestion(quizId: string, token: string | undefined, index: number, answer: string): Promise<Feedback> {
  const quiz = await loadQuiz(quizId, token);
  if (!quiz) return { kind: 'error', message: 'This quiz link isn’t valid.' };
  if (quizWindow(quiz) !== 'open') return { kind: 'error', message: 'This quiz is closed.' };
  const questions = quiz.questions_json as Question[];
  const question = questions[index];
  if (!question) return { kind: 'error', message: 'That question doesn’t exist.' };

  const responses = { ...((quiz.responses_json ?? {}) as Record<string, string>) };
  if (responses[index] === undefined) {
    responses[index] = answer.slice(0, 2000);
    await db.quiz.update({ where: { id: quizId }, data: { responses_json: responses } });
  }

  if (quiz.kind === 'baseline') return { kind: 'saved' };
  const grade = gradeDeterministic(question, responses[index]);
  if (!grade) return { kind: 'saved' };
  return { kind: 'graded', correct: grade.score === 1, explanation: grade.rationale };
}

export async function finishQuiz(quizId: string, token: string | undefined): Promise<{ ok: boolean; message?: string }> {
  const quiz = await loadQuiz(quizId, token);
  if (!quiz) return { ok: false, message: 'This quiz link isn’t valid.' };
  if (quiz.completed_at) return { ok: true };
  if (quizWindow(quiz) !== 'open') return { ok: false, message: 'This quiz is closed.' };

  await db.quiz.update({ where: { id: quizId }, data: { completed_at: new Date() } });

  // A student taking the post-session quiz confirms the session happened (the family's side).
  if (quiz.kind === 'post' && !quiz.session.family_confirmed_at) {
    await db.session.update({ where: { id: quiz.session_id }, data: { family_confirmed_at: new Date() } });
    if (quiz.session.tutor_confirmed_at) await startJob('releasePayment', quiz.session_id);
  }
  await startJob('gradeQuiz', quizId);
  return { ok: true };
}
