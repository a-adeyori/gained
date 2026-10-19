// The Render Workflow service: every slow or money-moving step runs here, never in the web
// service. Tasks take only IDs, since Render retains task arguments and return values.
// Started with `npm run workflow`; locally, `render workflows dev -- npm run workflow`.

import { task, type TaskContext } from '@renderinc/sdk/workflows';
import {
  extractTopicsStep,
  gradeQuizStep,
  prepareQuizzesStep,
  releasePaymentStep,
  settleSessionStep,
  transcribeAudioStep,
  writeBaselineStep,
} from '../lib/pipeline';

const retry = { maxRetries: 3, waitDurationMs: 5000, backoffScaling: 2 };

export const transcribeAudio = task(
  { name: 'transcribeAudio', retry, timeoutSeconds: 1800 },
  async (_ctx: TaskContext, sessionId: string) => {
    await transcribeAudioStep(sessionId);
  },
);

export const extractTopics = task(
  { name: 'extractTopics', retry, timeoutSeconds: 600 },
  async (_ctx: TaskContext, sessionId: string) => {
    await extractTopicsStep(sessionId);
  },
);

export const processSession = task(
  { name: 'processSession', timeoutSeconds: 3600 },
  async (ctx: TaskContext, sessionId: string) => {
    await ctx.run(transcribeAudio, sessionId);
    await ctx.run(extractTopics, sessionId);
  },
);

export const writeBaseline = task(
  { name: 'writeBaseline', retry, timeoutSeconds: 600 },
  async (_ctx: TaskContext, sessionId: string) => {
    await writeBaselineStep(sessionId);
  },
);

// "writeQuiz" in the PRD: the post-session and retention quizzes, once topics are confirmed.
export const prepareQuizzes = task(
  { name: 'prepareQuizzes', retry, timeoutSeconds: 900 },
  async (_ctx: TaskContext, sessionId: string) => {
    await prepareQuizzesStep(sessionId);
  },
);

export const gradeQuiz = task(
  { name: 'gradeQuiz', retry, timeoutSeconds: 600 },
  async (_ctx: TaskContext, quizId: string) => {
    await gradeQuizStep(quizId);
  },
);

// Captures and voids are idempotent (PayPal-Request-Id per step), so retries are safe.
export const releasePayment = task(
  { name: 'releasePayment', retry, timeoutSeconds: 300 },
  async (_ctx: TaskContext, sessionId: string) => {
    await releasePaymentStep(sessionId);
  },
);

export const settleSession = task(
  { name: 'settleSession', retry, timeoutSeconds: 300 },
  async (_ctx: TaskContext, sessionId: string) => {
    await settleSessionStep(sessionId);
  },
);
