import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { TopicListSchema } from '@/lib/claude';
import { db } from '@/lib/db';
import { LiveSession } from './live-session';

export const metadata: Metadata = { title: 'Live session' };

export default async function LivePage({ params }: PageProps<'/sessions/[id]/live'>) {
  const { id } = await params;
  const user = await requireUser('tutor');
  const session = await db.session.findUnique({ where: { id }, include: { student: true, escrow: true } });
  if (!session || session.tutor_id !== user.id) notFound();
  if (!session.escrow) redirect(`/sessions/${id}`);
  if (session.topics_confirmed_at) redirect(`/sessions/${id}`);

  const topics = session.topics_json ? TopicListSchema.safeParse(session.topics_json) : null;
  return (
    <LiveSession
      sessionId={session.id}
      studentName={session.student.name}
      studentIsMinor={session.student.is_minor}
      subject={session.subject}
      plannedTopics={session.planned_topics}
      meetingPlace={session.meeting_place}
      startAt={session.start_at.toISOString()}
      initialStage={session.status === 'booked' || session.status === 'live' ? 'before' : 'processing'}
      initialTopics={topics?.success ? topics.data : null}
    />
  );
}
