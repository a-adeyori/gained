// /progress: a parent's view of what their payments bought (PRD screen 8): learning gain over
// time per subject (and per child), where the money went, and every session's before and after.

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink, Card, EscrowBadge, Money, PageTitle } from '@/components/ui';
import { LocalTime } from '@/components/local-time';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ESCROW_STATES, type EscrowStateKey } from '@/lib/escrow-states';
import { escrowMoney } from '@/lib/studio-data';
import { GainChart, type GainSeries } from './gain-chart';

export const metadata: Metadata = { title: 'Progress' };


export default async function ProgressPage() {
  const user = await requireUser('parent');

  // Sessions this parent paid for, plus any booked for their children by someone else.
  const sessions = await db.session.findMany({
    where: { escrow: { isNot: null }, OR: [{ payer_id: user.id }, { student: { parent_id: user.id } }] },
    include: { student: { select: { id: true, name: true } }, tutor: { select: { name: true } }, escrow: true, result: true },
    orderBy: { start_at: 'asc' },
  });

  if (sessions.length === 0) {
    return (
      <>
        <PageTitle eyebrow="Progress" title="What they've learned" />
        <Card className="max-w-xl">
          <h2 className="text-lg font-medium">Nothing to show yet</h2>
          <p className="mt-1 text-ink-soft">
            After each session a short quiz measures progress. Gains and what you paid for them will show up here.
          </p>
          <ButtonLink href="/book" className="mt-5">
            Book a session
          </ButtonLink>
        </Card>
      </>
    );
  }

  const rows = sessions.map((s) => ({
    session: s,
    money: escrowMoney({ price_cents: s.price_cents, escrow: s.escrow!, result: s.result }),
  }));
  const totals = rows.reduce(
    (t, { session, money }) => ({
      held: t.held + session.price_cents,
      paid: t.paid + money.capturedCents,
      returned: t.returned + money.returnedCents,
      stillHeld: t.stillHeld + money.heldCents,
    }),
    { held: 0, paid: 0, returned: 0, stillHeld: 0 },
  );

  // One panel per subject, or per child and subject when there is more than one child.
  const students = new Set(sessions.map((s) => s.student.id));
  const byChild = students.size > 1;
  const groups = new Map<string, GainSeries>();
  for (const s of sessions) {
    const gain = s.result?.gain_quiz;
    if (gain == null) continue;
    const key = byChild ? `${s.student.id}:${s.subject}` : s.subject;
    const title = byChild ? `${s.student.name.split(' ')[0]} · ${s.subject}` : s.subject;
    const group = groups.get(key) ?? { key, title, points: [] };
    group.points.push({
      sessionId: s.id,
      at: s.start_at.toISOString(),
      gain,
      pre: s.result?.pre_score ?? null,
      post: s.result?.post_score ?? null,
      tutor: s.tutor.name,
    });
    groups.set(key, group);
  }
  const series = [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      <PageTitle eyebrow="Progress" title="What they've learned">
        Learning gain is how much of the room to improve a session closed: going from 40% to 70% on the quiz is a 50% gain.
      </PageTitle>

      <section aria-label="Summary" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions" value={<span className="num">{sessions.length}</span>} />
        <Stat
          label="Total held"
          value={<Money cents={totals.held} />}
          note={totals.stillHeld > 0 ? <><Money cents={totals.stillHeld} /> still held, not charged</> : 'Nothing held right now'}
        />
        <Stat label="Paid to tutors" value={<Money cents={totals.paid} className="text-gain-ink" />} />
        <Stat label="Returned to you" value={<Money cents={totals.returned} />} />
      </section>

      <MoneySplit paid={totals.paid} returned={totals.returned} held={totals.stillHeld} />

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Learning gain over time</h2>
        {series.length ? (
          <GainChart series={series} />
        ) : (
          <Card>
            <p className="text-ink-soft">Gains appear after the first post-session quiz is graded.</p>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Sessions</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {[...rows].reverse().map(({ session: s }) => {
            const r = s.result;
            return (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex flex-col gap-1 px-4 py-3.5 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.subject}
                      {byChild && <span className="text-ink-soft"> · {s.student.name.split(' ')[0]}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      <LocalTime iso={s.start_at.toISOString()} format="date" /> · with {s.tutor.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {r?.pre_score != null && r.post_score != null ? (
                      <span className="num text-sm text-ink-soft">
                        {Math.round(r.pre_score)}% → <span className="font-medium text-ink">{Math.round(r.post_score)}%</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted">No scores yet</span>
                    )}
                    {r?.gain_quiz != null && (
                      <span className="num text-sm font-medium text-gain-ink">+{Math.round(r.gain_quiz * 100)}% gain</span>
                    )}
                    <Money cents={s.price_cents} className="text-sm text-ink-soft" />
                    <EscrowBadge state={s.escrow!.state as EscrowStateKey} checkInDone={s.result?.retention_score != null} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3.5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

/** Where every held dollar went: one bar split into paid, returned and still held. */
function MoneySplit({ paid, returned, held }: { paid: number; returned: number; held: number }) {
  const total = paid + returned + held;
  if (total === 0) return null;
  const parts = [
    { label: 'Paid to tutors', cents: paid, color: 'var(--gain)' },
    { label: 'Returned to you', cents: returned, color: ESCROW_STATES.returned.color },
    { label: 'Still held', cents: held, color: ESCROW_STATES.held.color },
  ].filter((p) => p.cents > 0);
  return (
    <section aria-label="Paid versus returned" className="mb-10">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) => (
          <span key={p.label} style={{ width: `${(p.cents / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-ink-soft">{p.label}</span>
            <Money cents={p.cents} className="font-medium" />
            <span className="num text-muted">{Math.round((p.cents / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
