// The tutor ends the session with a summary of what they taught: this counts as the tutor's
// side of "marked complete", and starts the pipeline, which turns the summary into topics.
// Sessions aren't recorded, so the summary is what the post-session quiz is written from.

import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, HttpError, json, sessionForTutor } from '@/lib/api';
import { startJob } from '@/lib/jobs';
import { notifySessionEnded } from '@/lib/notify';

const Body = z.object({ notes: z.string().max(2000).optional() });

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/sessions/[id]/end'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  if (!['booked', 'live'].includes(session.status)) return json({ status: session.status });

  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new HttpError(400, 'Keep the summary under 2,000 characters.');
  const notes = body.data.notes?.trim() || null;
  if (!notes) throw new HttpError(400, 'Write what you taught (the subtopics or a short summary). The quiz is written from it.');

  const now = new Date();
  await db.session.update({
    where: { id },
    data: { status: 'ended', ended_at: now, tutor_confirmed_at: now, notes },
  });
  await notifySessionEnded(id);
  await startJob('processSession', id);
  if (session.family_confirmed_at) await startJob('releasePayment', id);
  return json({ status: 'ended' });
});
