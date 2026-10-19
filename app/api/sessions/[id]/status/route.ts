// Polled by the live-session screen while the pipeline runs.

import { TopicListSchema } from '@/lib/claude';
import { db } from '@/lib/db';
import { handle, json, sessionForTutor } from '@/lib/api';
import { quizToken } from '@/lib/signing';

export const GET = handle(async (_req: Request, ctx: RouteContext<'/api/sessions/[id]/status'>) => {
  const { id } = await ctx.params;
  const session = await sessionForTutor(id);
  const topics = session.topics_json ? TopicListSchema.safeParse(session.topics_json) : null;
  const post = await db.quiz.findUnique({ where: { session_id_kind: { session_id: id, kind: 'post' } } });
  return json({
    status: session.status,
    topics: topics?.success ? topics.data : null,
    topicsConfirmed: !!session.topics_confirmed_at,
    postQuizPath: post ? `/quiz/${post.id}?t=${quizToken(post.id)}` : null,
    error: session.pipeline_error,
  });
});
