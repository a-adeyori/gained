// The tutor taps Start: the session goes live.

import { db } from '@/lib/db';
import { handle, HttpError, json, sessionForTutor } from '@/lib/api';

export const POST = handle(async (_req: Request, ctx: RouteContext<'/api/sessions/[id]/start'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  if (!['booked', 'live'].includes(session.status)) throw new HttpError(409, 'This session has already ended.');
  await db.session.update({ where: { id }, data: { status: 'live' } });
  return json({ status: 'live' });
});
