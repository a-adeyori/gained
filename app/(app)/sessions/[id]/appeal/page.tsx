// PRD screen 9: dispute a grade within 72 hours, with a reason.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { appealWindowClosesAt } from '@/lib/retention';
import { AppealForm } from './appeal-form';

export const metadata: Metadata = { title: 'Appeal' };

export default async function AppealPage({ params }: PageProps<'/sessions/[id]/appeal'>) {
  const { id } = await params;
  const user = await requireUser();
  const session = await db.session.findUnique({ where: { id }, include: { tutor: true, student: true } });
  if (!session || ![session.payer_id, session.student_id, session.tutor_id].includes(user.id)) notFound();
  const closesAt = session.ended_at ? appealWindowClosesAt(session.ended_at) : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow={`${session.subject} · ${session.student.name} with ${session.tutor.name}`} title="Appeal a grade">
        An admin reviews every appeal. The final payment waits until it’s resolved, and nothing is lost while it does.
      </PageTitle>
      <Card>
        {closesAt && new Date() < closesAt ? (
          <AppealForm sessionId={id} closesAt={closesAt.toISOString()} />
        ) : (
          <p className="text-ink-soft">Appeals are open for 72 hours after the session. This window has closed.</p>
        )}
      </Card>
    </div>
  );
}
