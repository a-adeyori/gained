// Tutor availability and booking profile: open times on a Bryntum week view, booked
// sessions shown read-only, and the price, subjects, bio and payout email families see.

import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui';
import type { CalendarRange, CalendarSession } from '@/components/scheduler/types';
import { requireUser } from '@/lib/auth';
import { isBlocking, normalizeSubjects } from '@/lib/booking';
import { db } from '@/lib/db';
import type { EscrowStateKey } from '@/lib/escrow-states';
import { AvailabilityBoardLoader } from './board-loader';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Availability' };

export default async function AvailabilityPage() {
  const user = await requireUser('tutor');
  const now = new Date();
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);

  const [rangeRows, sessionRows] = await Promise.all([
    db.availability.findMany({ where: { tutor_id: user.id, end_at: { gt: since } }, orderBy: { start_at: 'asc' } }),
    db.session.findMany({
      where: { tutor_id: user.id, status: { not: 'cancelled' }, end_at: { gt: since } },
      select: {
        id: true,
        start_at: true,
        end_at: true,
        status: true,
        created_at: true,
        subject: true,
        student: { select: { name: true } },
        escrow: { select: { state: true } },
      },
      orderBy: { start_at: 'asc' },
    }),
  ]);

  const ranges: CalendarRange[] = rangeRows.map((r) => ({
    id: r.id,
    tutorId: user.id,
    start: r.start_at.toISOString(),
    end: r.end_at.toISOString(),
  }));
  const sessions: CalendarSession[] = sessionRows
    .filter((s) => isBlocking({ ...s, has_escrow: s.escrow !== null }, now))
    .map((s) => ({
      id: s.id,
      tutorId: user.id,
      start: s.start_at.toISOString(),
      end: s.end_at.toISOString(),
      state: (s.escrow?.state ?? null) as EscrowStateKey | null,
      label: `${s.subject} · ${s.student.name}`,
      href: ['booked', 'live', 'ended'].includes(s.status) ? `/sessions/${s.id}/live` : `/sessions/${s.id}`,
    }));

  const profileMissing = !user.price_cents || normalizeSubjects(user.subjects).length === 0 || !user.meeting_link;

  const openSlots = ranges.length;
  const profile = (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">{profileMissing ? '1' : '2'} · Your profile</h2>
      <Card className="max-w-xl">
        <ProfileForm
          priceCents={user.price_cents}
          subjects={normalizeSubjects(user.subjects)}
          bio={user.bio ?? ''}
          meetingLink={user.meeting_link ?? ''}
          paypalEmail={user.paypal_email ?? user.email}
        />
      </Card>
    </section>
  );
  const calendar = (
    <section>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted">{profileMissing ? '2' : '1'} · Your open times</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Drag across the Open time row to add a block. Families can book any free 30, 60 or 90 minutes inside it.
      </p>
      <AvailabilityBoardLoader ranges={ranges} sessions={sessions} />
    </section>
  );

  return (
    <>
      <PageTitle eyebrow="Profile & availability" title="When can families book you?" />

      {/* Families only see tutors with a price, a subject and a meeting link, so say so loudly. */}
      {profileMissing ? (
        <div
          role="alert"
          className="mb-10 flex items-start gap-4 rounded-3xl p-5 sm:p-6"
          style={{ background: 'color-mix(in srgb, #ff6b4a 16%, var(--card))', border: '1.5px solid color-mix(in srgb, #ff6b4a 60%, transparent)' }}
        >
          <span className="text-2xl" aria-hidden="true">
            🙈
          </span>
          <div>
            <p className="font-display text-2xl tracking-tight">Parents can’t see you yet</p>
            <p className="mt-1 text-ink-soft">
              Set your <strong className="text-ink">hourly price</strong>, pick at least one <strong className="text-ink">subject</strong>{' '}
              and add your <strong className="text-ink">Zoom or Google Meet link</strong> below.
              {openSlots > 0 ? ` Your ${openSlots} open time${openSlots > 1 ? 's' : ''} will show up for families as soon as you save.` : ''}
            </p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="mb-10 flex items-center gap-3 rounded-3xl px-5 py-4"
          style={{ background: 'color-mix(in srgb, #3ccf7f 14%, var(--card))', border: '1.5px solid color-mix(in srgb, #3ccf7f 50%, transparent)' }}
        >
          <span className="size-2.5 rounded-full bg-gain" aria-hidden="true" />
          <p>
            <span className="font-medium">You’re visible to parents.</span>{' '}
            <span className="text-ink-soft">
              {openSlots > 0 ? `${openSlots} open time${openSlots > 1 ? 's' : ''} in the next few weeks.` : 'Add open times below so they can book you.'}
            </span>
          </p>
        </div>
      )}

      <div className="space-y-12">
        {profileMissing ? (
          <>
            {profile}
            {calendar}
          </>
        ) : (
          <>
            {calendar}
            {profile}
          </>
        )}
      </div>
    </>
  );
}
