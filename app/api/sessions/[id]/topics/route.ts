// The tutor confirms (or edits) the AI's topic list in one tap; then both quizzes are written.

import { z } from 'zod';
import { TopicListSchema } from '@/lib/claude';
import { db } from '@/lib/db';
import { handle, HttpError, json, sessionForTutor } from '@/lib/api';
import { startJob } from '@/lib/jobs';

const Body = z.object({ topics: TopicListSchema.shape.topics.optional() });

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/sessions/[id]/topics'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  if (session.topics_confirmed_at) return json({ status: session.status });
  if (!session.topics_json) throw new HttpError(409, 'The topic list isn’t ready yet.');

  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new HttpError(400, 'That topic list isn’t valid.');
  const current = TopicListSchema.parse(session.topics_json);
  const topics = body.data.topics?.filter((t) => t.name.trim()) ?? current.topics;
  if (!topics.length) throw new HttpError(400, 'Keep at least one topic.');

  await db.session.update({
    where: { id },
    data: {
      topics_json: { ...current, topics },
      topics_confirmed_at: new Date(),
      status: session.status === 'ended' ? 'topics_confirmed' : session.status,
    },
  });
  await startJob('prepareQuizzes', id);
  return json({ status: 'topics_confirmed' });
});
