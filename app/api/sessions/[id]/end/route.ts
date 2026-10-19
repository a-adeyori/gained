// The tutor ends the session: this counts as the tutor's side of "marked complete", and starts
// the pipeline (transcribe, then extract topics).

import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, HttpError, json, sessionForTutor } from '@/lib/api';
import { startJob } from '@/lib/jobs';

const Body = z.object({ notes: z.string().max(2000).optional() });

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/sessions/[id]/end'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  if (!['booked', 'live'].includes(session.status)) return json({ status: session.status });

  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new HttpError(400, 'Notes are too long.');
  const notes = body.data.notes?.trim() || null;
  if (!session.consent_recording && !notes) throw new HttpError(400, 'Add 3–5 bullet points on what you covered.');

  const now = new Date();
  await db.session.update({
    where: { id },
    data: { status: 'ended', ended_at: now, tutor_confirmed_at: now, notes },
  });
  await startJob('processSession', id);
  if (session.family_confirmed_at) await startJob('releasePayment', id);
  return json({ status: 'ended' });
});
