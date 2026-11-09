// PRD screen 3: the payer approves a PayPal hold for the full price. Explains in plain words
// what happens to the money, then shows "held, not charged" once approved.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ButtonLink, Card, Money, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import type { EscrowStateKey } from '@/lib/escrow-states';
import { meetingService } from '@/lib/meeting';
import { baseCentsFor } from '@/lib/payout';
import { CheckoutPanel } from './checkout-panel';
import { LocalTime } from './local-time';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({ params }: PageProps<'/sessions/[id]/checkout'>) {
  const { id } = await params;
  const user = await requireUser();
  const session = await db.session.findUnique({
    where: { id },
    include: { tutor: { select: { name: true, meeting_link: true } }, student: { select: { id: true, name: true } }, escrow: { select: { state: true } } },
  });
  // Anyone but the payer gets a plain 404, so session IDs reveal nothing.
  if (!session || session.payer_id !== user.id) notFound();

  const price = session.price_cents;
  const base = baseCentsFor(price);
  const bonus = price - base;
  const state = (session.escrow?.state ?? null) as EscrowStateKey | null;
  const minutes = Math.round((session.end_at.getTime() - session.start_at.getTime()) / 60_000);
  const cancelled = !state && session.status === 'cancelled';

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Checkout" title={state ? 'You’re booked' : 'Hold your session'}>
        {state ? 'Your payment is held, not charged.' : 'Approve a hold in PayPal. Nothing is charged today.'}
      </PageTitle>

      <Card className="mb-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted">Tutor</dt>
          <dd className="font-medium">{session.tutor.name}</dd>
          <dt className="text-muted">For</dt>
          <dd>{session.student.id === user.id ? 'You' : session.student.name}</dd>
          <dt className="text-muted">When</dt>
          <dd>
            <LocalTime iso={session.start_at.toISOString()} endIso={session.end_at.toISOString()} />
            <span className="text-muted"> · {minutes} min</span>
          </dd>
          <dt className="text-muted">Where</dt>
          <dd>
            Online{session.tutor.meeting_link && meetingService(session.tutor.meeting_link) ? ` on ${meetingService(session.tutor.meeting_link)}` : ''}
            <span className="text-muted"> · the link comes in your booking email once the hold is approved</span>
          </dd>
          <dt className="text-muted">Subject</dt>
          <dd>{session.subject}</dd>
          <dt className="text-muted">Covering</dt>
          <dd className="text-ink-soft">{session.planned_topics}</dd>
          <dt className="text-muted">Quiz</dt>
          <dd className="text-ink-soft">Written from what the tutor says they taught. Sessions aren’t recorded.</dd>
        </dl>
        <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm text-muted">Full price</span>
          <Money cents={price} className="text-2xl font-semibold" />
        </div>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">What happens to your money</h2>
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            The full <Money cents={price} className="font-medium" /> is <strong>held</strong> on your PayPal account, <strong>not charged</strong>.
          </Step>
          <Step n={2}>
            After the session, <Money cents={base} className="font-medium" /> (80%) goes to the tutor as the guaranteed base.
          </Step>
          <Step n={3}>
            Up to <Money cents={bonus} className="font-medium" /> more (20%) depends on the quiz right after the session and a short check-in 48 hours later.
          </Step>
          <Step n={4}>Whatever isn’t earned comes back to you automatically. You don’t need to do anything.</Step>
        </ol>
      </section>

      {cancelled ? (
        <Card>
          <p className="font-medium">This booking was cancelled.</p>
          <p className="mt-1 text-sm text-muted">Nothing was held or charged. Pick another time to book again.</p>
          <ButtonLink href="/book" className="mt-4">
            Book another time
          </ButtonLink>
        </Card>
      ) : (
        <CheckoutPanel sessionId={session.id} priceCents={price} initialState={state} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID} />
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-ink-soft">{n}</span>
      <span className="pt-0.5 text-ink-soft">{children}</span>
    </li>
  );
}
