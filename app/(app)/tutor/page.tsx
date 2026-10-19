// /tutor: the tutor's AG Studio dashboard of sessions, earnings and learning gain (PRD screen 7).
// The rows load in the browser from /api/tutor/data; this page only checks there is something
// to show and whether the AI assistant can run.

import type { Metadata } from 'next';
import { ButtonLink, Card, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { TutorDashboard } from './dashboard/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function TutorDashboardPage() {
  const user = await requireUser('tutor');
  const { _count, _min, _max } = await db.session.aggregate({
    where: { tutor_id: user.id, escrow: { isNot: null } },
    _count: { _all: true },
    _min: { start_at: true },
    _max: { start_at: true },
  });

  if (_count._all === 0 || !_min.start_at || !_max.start_at) {
    return (
      <>
        <PageTitle eyebrow="Dashboard" title="Your teaching, in numbers" />
        <Card className="max-w-xl">
          <h2 className="text-lg font-medium">No sessions yet</h2>
          <p className="mt-1 text-ink-soft">
            Once a family books you and approves the hold, your sessions, earnings and your students&apos; learning gains
            show up here, with an assistant you can ask about them.
          </p>
          <ButtonLink href="/tutor/availability" className="mt-5">
            Add availability
          </ButtonLink>
        </Card>
      </>
    );
  }

  // The AI module needs an AG Studio licence, and the proxy needs the Anthropic key. Only booleans
  // reach the browser; the key stays on the server.
  const aiEnabled = Boolean(process.env.AG_STUDIO && process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <PageTitle eyebrow="Dashboard" title="Your teaching, in numbers" />
      <TutorDashboard
        licenseKey={process.env.AG_STUDIO || undefined}
        aiEnabled={aiEnabled}
        from={day(_min.start_at)}
        to={day(_max.start_at)}
      />
    </>
  );
}
