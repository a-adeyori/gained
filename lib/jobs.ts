// Starts background work. On Render, each job is a task on the workflow service
// (workflow/index.ts). Locally, with WORKFLOW_MODE=inline, the same step runs in this process
// so the app works end to end without a deployed workflow. Server-only.

import { Render } from '@renderinc/sdk';

export const JOBS = [
  'writeBaseline',
  'processSession',
  'prepareQuizzes',
  'gradeQuiz',
  'releasePayment',
  'settleSession',
  'cancelSession',
] as const;
export type JobName = (typeof JOBS)[number];

const WORKFLOW_SLUG = process.env.RENDER_WORKFLOW_SLUG ?? 'gained-workflow';

let render: Render | undefined;

/** `wait` (inline mode only) awaits the step, for scripts that exit when they finish. */
export async function startJob(name: JobName, id: string, opts: { wait?: boolean } = {}): Promise<void> {
  if (process.env.WORKFLOW_MODE === 'inline') {
    const steps = await import('./pipeline');
    const run: Record<JobName, (id: string) => Promise<unknown>> = {
      writeBaseline: steps.writeBaselineStep,
      processSession: steps.processSessionStep,
      prepareQuizzes: steps.prepareQuizzesStep,
      gradeQuiz: steps.gradeQuizStep,
      releasePayment: steps.releasePaymentStep,
      settleSession: steps.settleSessionStep,
      cancelSession: steps.cancelSessionStep,
    };
    const job = run[name](id).catch((err) => console.error(`Inline job ${name}(${id}) failed`, err));
    // Not awaited by default: the request returns while the step runs, as it would on Render.
    if (opts.wait) await job;
    return;
  }
  render ??= new Render();
  await render.workflows.startTask(`${WORKFLOW_SLUG}/${name}`, [id]);
}
