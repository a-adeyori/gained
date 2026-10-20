// `npm run cron`: the every-15-minutes work in lib/scheduled.ts, as a one-shot script (a Render
// Cron Job on paid plans, or by hand locally). On the free plan, POST /api/cron runs the same.

import { db } from '../lib/db';
import { runScheduledTasks } from '../lib/scheduled';

runScheduledTasks({ wait: process.env.WORKFLOW_MODE === 'inline' })
  .then(async (result) => {
    console.log('scheduled tasks done', result);
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
