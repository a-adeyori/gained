// The post-session pipeline, one function per workflow task. Every step takes only IDs and
// is safe to retry: each checks what is already done before doing it. Server-only.
//
//   booking authorized   -> writeBaseline
//   tutor taps End       -> processSession = transcribeAudio (a no-op: sessions are no longer
//                           recorded), then extractTopics from the tutor's summary
//   tutor confirms topics -> prepareQuizzes (post-session quiz now, retention quiz held)
//   both sides confirm   -> releasePayment (the 80% base)
//   student submits quiz -> gradeQuiz
//   cron, after retention and the appeal window -> settleSession

import { AiFailure, extractTopics, gradeWritten, summarizeResult, writeBaseline, writeQuiz, type Question, type TopicList } from './claude';
import { db } from './db';
import { notifyQuiz, notifyTopicsReady } from './notify';
import { captureBase, settle } from './escrow';
import { gradeDeterministic, quizScore } from './grading';
import { deleteMedia, listMedia } from './media';
import { transcribe } from './transcribe';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function recordError(sessionId: string, step: string, err: unknown) {
  console.error(`${step} failed for session ${sessionId}`, err);
  await db.session.update({ where: { id: sessionId }, data: { pipeline_error: `${step}: ${message(err)}` } });
}

const questionsOf = (quiz: { questions_json: unknown } | null | undefined) => (quiz?.questions_json ?? []) as Question[];

// --- Baseline -------------------------------------------------------------------------

export async function writeBaselineStep(sessionId: string) {
  const existing = await db.quiz.findUnique({ where: { session_id_kind: { session_id: sessionId, kind: 'baseline' } } });
  if (existing) return existing.id;
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  try {
    const questions = await writeBaseline(session.subject, session.planned_topics);
    const quiz = await db.quiz.create({
      data: { session_id: sessionId, kind: 'baseline', questions_json: questions, sent_at: new Date() },
    });
    await notifyQuiz(quiz.id);
    return quiz.id;
  } catch (err) {
    // No baseline means nothing to compare against; the session still runs and pays the base.
    await recordError(sessionId, 'Baseline quiz', err);
    return null;
  }
}

// --- After the session ----------------------------------------------------------------

export async function transcribeAudioStep(sessionId: string) {
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.transcript !== null) return;
  const recordings = await listMedia(sessionId, 'audio');
  if (!recordings.length) return;
  try {
    const parts: string[] = [];
    for (const r of recordings) parts.push(await transcribe(r.data, r.mime));
    await db.session.update({ where: { id: sessionId }, data: { transcript: parts.join('\n\n') } });
  } catch (err) {
    // Topics then come from what was planned at booking; the tutor reviews them.
    await recordError(sessionId, 'Transcription', err);
  } finally {
    // Audio is deleted right after transcription, whether or not it worked.
    await deleteMedia(sessionId, 'audio');
  }
}

/** The fallback when the AI can't produce a topic list: the tutor's own bullets or plan. */
function topicsFromNotes(text: string): TopicList {
  const lines = text
    .split(/\n|;|•/)
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    topics: lines.map((name) => ({ name, skills: [name], problem_types: [] })),
    worked_problems: [],
    summary: 'Built from the tutor\'s notes because the AI topic list was unavailable.',
  };
}

export async function extractTopicsStep(sessionId: string) {
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.topics_json) return;
  const photos = await listMedia(sessionId, 'photo');
  try {
    const topics = await extractTopics({
      subject: session.subject,
      plannedTopics: session.planned_topics,
      transcript: session.transcript,
      notes: session.notes,
      photos: photos.map((p) => ({
        mediaType: (['image/png', 'image/webp'].includes(p.mime) ? p.mime : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
        base64: p.data.toString('base64'),
      })),
    });
    await db.session.update({ where: { id: sessionId }, data: { topics_json: topics } });
  } catch (err) {
    if (!(err instanceof AiFailure)) throw err;
    await recordError(sessionId, 'Topic extraction', err);
    await db.session.update({
      where: { id: sessionId },
      data: { topics_json: topicsFromNotes(session.notes || session.planned_topics) },
    });
  } finally {
    await deleteMedia(sessionId, 'photo');
  }
  await notifyTopicsReady(sessionId);
}

/** Both quizzes are written once the tutor confirms the topics; the retention one is held. */
export async function prepareQuizzesStep(sessionId: string) {
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { quizzes: true } });
  if (!session.topics_confirmed_at || !session.topics_json) throw new Error('Topics are not confirmed yet');
  const topics = session.topics_json as TopicList;
  const byKind = (kind: string) => session.quizzes.find((q) => q.kind === kind);
  const baseline = questionsOf(byKind('baseline'));

  try {
    let post = byKind('post');
    if (!post) {
      const questions = await writeQuiz({ kind: 'post', subject: session.subject, topics, baseline, avoid: [] });
      post = await db.quiz.create({
        data: { session_id: sessionId, kind: 'post', questions_json: questions, sent_at: new Date() },
      });
      await notifyQuiz(post.id);
    }
    if (!byKind('retention')) {
      const questions = await writeQuiz({
        kind: 'retention',
        subject: session.subject,
        topics,
        baseline,
        avoid: questionsOf(post),
      });
      // sent_at and closes_at are set by the cron job 48 hours after the session ends.
      await db.quiz.create({ data: { session_id: sessionId, kind: 'retention', questions_json: questions } });
    }
  } catch (err) {
    if (!(err instanceof AiFailure)) throw err;
    // A missing quiz is scored at the tutor's rolling average gain at settlement.
    await recordError(sessionId, 'Quiz writing', err);
  }
}

// --- Money ------------------------------------------------------------------------------

export async function releasePaymentStep(sessionId: string) {
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.tutor_confirmed_at || !session.family_confirmed_at) throw new Error('Both sides must confirm the session first');
  await captureBase(sessionId);
  await db.session.update({ where: { id: sessionId }, data: { status: 'complete' } });
}

export async function settleSessionStep(sessionId: string) {
  await settle(sessionId);
}

// --- Grading --------------------------------------------------------------------------------

export async function gradeQuizStep(quizId: string) {
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { session: true } });
  if (quiz.score !== null) return quiz.score;
  const questions = questionsOf(quiz);
  const responses = (quiz.responses_json ?? {}) as Record<string, string>;

  const graded: { score: number; rationale: string }[] = [];
  for (const [i, question] of questions.entries()) {
    const answer = responses[i] ?? '';
    const exact = answer ? gradeDeterministic(question, answer) : { score: 0, rationale: `No answer. ${question.explanation}` };
    graded.push(
      exact ??
        (await gradeWritten(question, answer).catch((err: unknown) => {
          // Written answers that can't be graded go to the admin as a 0 with a flag, never silently.
          console.error(`Grading failed for quiz ${quizId} question ${i}`, err);
          return { score: 0, rationale: 'Automatic grading was unavailable; an admin will review this answer.' };
        })),
    );
  }
  const score = quizScore(graded.map((g) => g.score));

  await db.$transaction([
    ...graded.map((g, i) =>
      db.answer.upsert({
        where: { quiz_id_question_index: { quiz_id: quizId, question_index: i } },
        create: { quiz_id: quizId, question_index: i, answer: responses[i] ?? '', score: g.score, rationale: g.rationale },
        update: { answer: responses[i] ?? '', score: g.score, rationale: g.rationale },
      }),
    ),
    db.quiz.update({ where: { id: quizId }, data: { score } }),
  ]);

  const sessionId = quiz.session_id;
  const field = { baseline: 'pre_score', post: 'post_score', retention: 'retention_score' }[quiz.kind] as
    | 'pre_score'
    | 'post_score'
    | 'retention_score';
  await db.result.upsert({
    where: { session_id: sessionId },
    create: { session_id: sessionId, [field]: score },
    update: { [field]: score },
  });

  if (quiz.kind === 'post') {
    const result = await db.result.findUniqueOrThrow({ where: { session_id: sessionId } });
    if (result.pre_score !== null) {
      const rationale = await summarizeResult({
        subject: quiz.session.subject,
        pre: result.pre_score,
        post: score,
        perQuestion: questions.map((q, i) => ({ skill: q.skill, correct: graded[i].score >= 0.99, rationale: graded[i].rationale })),
      }).catch(() => null);
      if (rationale) await db.result.update({ where: { session_id: sessionId }, data: { rationale } });
    }
    await db.escrow.updateMany({ where: { session_id: sessionId, state: 'base_paid' }, data: { state: 'awaiting_retention' } });
  }
  return score;
}

// --- Orchestration ------------------------------------------------------------------------

export async function processSessionStep(sessionId: string) {
  await transcribeAudioStep(sessionId);
  await extractTopicsStep(sessionId);
}
