// PRD screen 10: every escrow by state, pipeline errors, and retry controls.

import type { Metadata } from 'next';
import Link from 'next/link';
import { EscrowBadge, Money, PageTitle } from '@/components/ui';
import { LocalTime } from '@/components/local-time';
import { requireUser } from '@/lib/auth';
import { cancellationFeeCents } from '@/lib/cancellation';
import { db } from '@/lib/db';
import { ESCROW_STATES, type EscrowStateKey } from '@/lib/escrow-states';
import { quizToken } from '@/lib/signing';
import { retryJob } from './actions';

export const metadata: Metadata = { title: 'Admin' };

/** How far back the tutor cancellation count looks. */
const TUTOR_CANCEL_DAYS = 90;


export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  await requireUser('admin');
  const { state } = await searchParams;
  const filter = typeof state === 'string' && state in ESCROW_STATES ? (state as EscrowStateKey) : null;

  const since = new Date();
  since.setDate(since.getDate() - TUTOR_CANCEL_DAYS);
  const [counts, sessions, cancellations] = await Promise.all([
    db.escrow.groupBy({ by: ['state'], _count: true }),
    db.session.findMany({
      where: { escrow: filter ? { state: filter } : { isNot: null } },
      include: { tutor: true, student: true, escrow: true, result: true, quizzes: true },
      orderBy: { start_at: 'desc' },
      take: 200,
    }),
    db.session.findMany({
      where: { status: 'cancelled', cancelled_at: { gte: since }, escrow: { isNot: null } },
      select: { tutor_id: true, cancelled_by_id: true, tutor: { select: { name: true } } },
    }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.state === s)?._count ?? 0;
  // Tutors who cancel often let families down; there's no automatic penalty, so admins watch this.
  const byTutor = new Map<string, { name: string; count: number }>();
  for (const c of cancellations) {
    if (c.cancelled_by_id !== c.tutor_id) continue;
    const row = byTutor.get(c.tutor_id) ?? { name: c.tutor.name, count: 0 };
    byTutor.set(c.tutor_id, { ...row, count: row.count + 1 });
  }
  const tutorCancels = [...byTutor.values()].sort((a, b) => b.count - a.count);
  const cancelledBy = (s: { cancelled_by_id: string | null; tutor_id: string; payer_id: string }) =>
    s.cancelled_by_id === s.tutor_id ? 'tutor' : s.cancelled_by_id === s.payer_id ? 'family' : 'admin';

  return (
    <>
      <PageTitle title="Escrows" />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/admin" className={`rounded-full border px-3 py-1 ${!filter ? 'border-ink' : 'border-line'}`}>
          All <span className="num text-muted">{counts.reduce((a, c) => a + c._count, 0)}</span>
        </Link>
        {(Object.keys(ESCROW_STATES) as EscrowStateKey[]).map((s) => (
          <Link key={s} href={`/admin?state=${s}`} className={`rounded-full border px-3 py-1 ${filter === s ? 'border-ink' : 'border-line'}`}>
            {ESCROW_STATES[s].label} <span className="num text-muted">{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      <p className="mb-6 text-sm text-ink-soft">
        <span className="font-medium text-ink">Cancelled by tutors, last {TUTOR_CANCEL_DAYS} days: </span>
        {tutorCancels.length
          ? tutorCancels.map((t, i) => (
              <span key={t.name}>
                {i > 0 && ', '}
                {t.name} <span className="num font-medium text-ink">{t.count}</span>
              </span>
            ))
          : 'none'}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Scores</th>
              <th className="px-4 py-3 font-medium">PayPal</th>
              <th className="px-4 py-3 font-medium">Quiz links</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sessions.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/sessions/${s.id}`} className="font-medium underline-offset-4 hover:underline">
                    {s.subject}: {s.student.name} / {s.tutor.name}
                  </Link>
                  <p className="text-xs text-muted">
                    <LocalTime iso={s.start_at.toISOString()} /> · {s.status}
                    {s.status === 'cancelled' && ` by ${cancelledBy(s)}`}
                    {s.status === 'cancelled' && cancellationFeeCents(s) > 0 && ' · late'}
                    {s.is_seed && ' · seed'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <EscrowBadge state={s.escrow!.state as EscrowStateKey} />
                  {s.escrow!.reauthorized && <p className="mt-1 text-xs text-muted">reauthorized</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Money cents={s.price_cents} />
                </td>
                <td className="num px-4 py-3 text-right text-ink-soft">
                  {[s.result?.pre_score, s.result?.post_score, s.result?.retention_score].map((v) => (v == null ? '–' : Math.round(v))).join(' / ')}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  <p>auth {s.escrow!.authorization_id}</p>
                  {s.escrow!.base_capture_id && <p>base {s.escrow!.base_capture_id}</p>}
                  {s.escrow!.bonus_capture_id && <p>bonus {s.escrow!.bonus_capture_id}</p>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {s.quizzes
                    .filter((q) => q.sent_at && !q.completed_at)
                    .map((q) => (
                      <p key={q.id}>
                        <Link href={`/quiz/${q.id}?t=${quizToken(q.id)}`} className="underline underline-offset-4">
                          {q.kind}
                        </Link>
                      </p>
                    ))}
                </td>
                <td className="px-4 py-3">
                  {s.pipeline_error && <p className="mb-2 max-w-64 text-xs text-state-appeal">{s.pipeline_error}</p>}
                  <form action={retryJob.bind(null, s.id)} className="flex gap-1">
                    <select name="job" defaultValue="" aria-label="Step to re-run" className="rounded-lg border border-line bg-card px-2 py-1 text-xs">
                      <option value="" disabled>
                        Re-run…
                      </option>
                      {s.status === 'cancelled' ? (
                        <option value="cancelSession">Release hold</option>
                      ) : (
                        <>
                          <option value="writeBaseline">Baseline</option>
                          <option value="processSession">Topics</option>
                          <option value="prepareQuizzes">Write quizzes</option>
                          <option value="releasePayment">Release base</option>
                          <option value="settleSession">Settle</option>
                        </>
                      )}
                    </select>
                    <button className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-2">Go</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sessions.length && <p className="px-4 py-8 text-center text-muted">No escrows{filter ? ` in ${ESCROW_STATES[filter].label}` : ''}.</p>}
      </div>
    </>
  );
}
