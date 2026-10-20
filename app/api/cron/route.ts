// POST /api/cron: the every-15-minutes work (lib/scheduled.ts), for the free plan where Render
// has no cron jobs. A scheduled GitHub Action calls it (.github/workflows/scheduled-tasks.yml),
// which also keeps the free web service from spinning down. Needs `Authorization: Bearer
// <CRON_SECRET>`; without CRON_SECRET set, the endpoint is off.

import { timingSafeEqual } from 'node:crypto';
import { runScheduledTasks } from '@/lib/scheduled';

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get('authorization'))) {
    return Response.json({ error: 'Not authorized.' }, { status: 401 });
  }
  try {
    // Jobs started here keep running in this process after the response (inline mode).
    const result = await runScheduledTasks();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('Scheduled tasks failed', err);
    return Response.json({ error: 'Scheduled tasks failed; see the server logs.' }, { status: 500 });
  }
}
