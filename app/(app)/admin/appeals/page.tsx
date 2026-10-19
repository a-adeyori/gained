// The appeal queue: read the dispute and the grades, then uphold or override the tutor pay.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EscrowBadge, Money, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import type { EscrowStateKey } from '@/lib/escrow-states';
import { baseCentsFor } from '@/lib/payout';
import { ResolveForm } from './resolve-form';

export const metadata: Metadata = { title: 'Appeals' };

export default async function AppealsPage() {
  await requireUser('admin');
  const appeals = await db.appeal.findMany({
    where: { status: 'open' },
    include: { session: { include: { tutor: true, student: true, escrow: true, result: true } } },
    orderBy: { created_at: 'asc' },
  });
  const openers = await db.user.findMany({ where: { id: { in: appeals.map((a) => a.opened_by) } } });

  return (
    <>
      <PageTitle title="Appeals">{appeals.length ? `${appeals.length} waiting` : 'Nothing waiting.'}</PageTitle>
      <div className="space-y-4">
        {appeals.map((a) => {
          const s = a.session;
          const opener = openers.find((u) => u.id === a.opened_by);
          return (
            <Card key={a.id} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/sessions/${s.id}`} className="font-medium underline underline-offset-4">
                    {s.subject}: {s.student.name} with {s.tutor.name}
                  </Link>
                  {s.escrow && <EscrowBadge state={s.escrow.state as EscrowStateKey} />}
                </div>
                <p className="mt-1 text-sm text-muted">
                  Opened by {opener?.name ?? 'unknown'} ({opener?.role}) · {a.created_at.toLocaleString('en-US')}
                </p>
                <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-ink-soft">{a.reason}</blockquote>
                <p className="num mt-3 text-sm text-ink-soft">
                  Scores {[s.result?.pre_score, s.result?.post_score, s.result?.retention_score].map((v) => (v == null ? '–' : Math.round(v))).join(' → ')}
                  {' · '}price <Money cents={s.price_cents} /> · base <Money cents={baseCentsFor(s.price_cents)} />
                </p>
              </div>
              <ResolveForm appealId={a.id} priceCents={s.price_cents} baseCents={baseCentsFor(s.price_cents)} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
