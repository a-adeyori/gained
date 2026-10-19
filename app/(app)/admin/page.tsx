// PRD screen 10: every escrow by state, pipeline errors, and retry controls.

import type { Metadata } from 'next';
import Link from 'next/link';
import { EscrowBadge, Money, PageTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ESCROW_STATES, type EscrowStateKey } from '@/lib/escrow-states';
import { quizToken } from '@/lib/signing';
import { retryJob } from './actions';

export const metadata: Metadata = { title: 'Admin' };

const short = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  await requireUser('admin');
  const { state } = await searchParams;
  const filter = typeof state === 'string' && state in ESCROW_STATES ? (state as EscrowStateKey) : null;

  const [counts, sessions] = await Promise.all([
    db.escrow.groupBy({ by: ['state'], _count: true }),
    db.session.findMany({
      where: { escrow: filter ? { state: filter } : { isNot: null } },
      include: { tutor: true, student: true, escrow: true, result: true, quizzes: true },
      orderBy: { start_at: 'desc' },
      take: 200,
    }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.state === s)?._count ?? 0;

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
                    {short(s.start_at)} · {s.status}
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
                      <option value="writeBaseline">Baseline</option>
                      <option value="processSession">Transcribe + topics</option>
                      <option value="prepareQuizzes">Write quizzes</option>
                      <option value="releasePayment">Release base</option>
                      <option value="settleSession">Settle</option>
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
