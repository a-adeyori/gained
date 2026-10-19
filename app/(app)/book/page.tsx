// PRD screen 2: a parent picks a tutor's open slot on the Bryntum calendar and books it.

import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui';
import type { CalendarRange, CalendarSession, CalendarTutor } from '@/components/scheduler/types';
import { requireUser } from '@/lib/auth';
import { isBlocking, normalizeSubjects } from '@/lib/booking';
import { db } from '@/lib/db';
import type { EscrowStateKey } from '@/lib/escrow-states';
import { BookingBoardLoader } from './board-loader';

export const metadata: Metadata = { title: 'Book a tutor' };

const WINDOW_DAYS = 14;

export default async function BookPage() {
  const user = await requireUser('parent');
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_DAYS * 24 * 3600_000);

  const [tutorRows, sessionRows, children] = await Promise.all([
    db.user.findMany({
      where: { role: 'tutor', price_cents: { gt: 0 } },
      select: {
        id: true,
        name: true,
        subjects: true,
        price_cents: true,
        availability: { where: { end_at: { gt: now }, start_at: { lt: until } }, orderBy: { start_at: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
    db.session.findMany({
      where: { tutor: { role: 'tutor' }, status: { not: 'cancelled' }, end_at: { gt: now }, start_at: { lt: until } },
      select: {
        id: true,
        tutor_id: true,
        payer_id: true,
        start_at: true,
        end_at: true,
        status: true,
        created_at: true,
        subject: true,
        student: { select: { name: true } },
        escrow: { select: { state: true } },
      },
    }),
    db.user.findMany({ where: { parent_id: user.id, role: 'student' }, select: { id: true, name: true, is_minor: true }, orderBy: { name: 'asc' } }),
  ]);

  const tutors: CalendarTutor[] = tutorRows
    .map((t) => ({ id: t.id, name: t.name, subjects: normalizeSubjects(t.subjects), priceCents: t.price_cents ?? 0 }))
    .filter((t) => t.subjects.length > 0);
  const tutorIds = new Set(tutors.map((t) => t.id));

  const ranges: CalendarRange[] = tutorRows
    .filter((t) => tutorIds.has(t.id))
    .flatMap((t) => t.availability.map((a) => ({ id: a.id, tutorId: t.id, start: a.start_at.toISOString(), end: a.end_at.toISOString() })));

  // Other families' sessions show only as "Booked"; the parent's own show their details.
  const sessions: (CalendarSession & { blocks: boolean })[] = sessionRows
    .filter((s) => tutorIds.has(s.tutor_id))
    .flatMap((s) => {
      const mine = s.payer_id === user.id;
      const blocks = isBlocking({ ...s, has_escrow: s.escrow !== null }, now);
      // A parent still sees their own unapproved booking so they can finish checkout.
      if (!blocks && !(mine && s.status === 'booked')) return [];
      const state = (s.escrow?.state ?? null) as EscrowStateKey | null;
      return [{
        id: s.id,
        tutorId: s.tutor_id,
        start: s.start_at.toISOString(),
        end: s.end_at.toISOString(),
        state,
        label: mine ? `${s.subject} · ${s.student.name.split(' ')[0]}${state ? '' : ' (approve hold)'}` : 'Booked',
        href: mine ? (state ? `/sessions/${s.id}` : `/sessions/${s.id}/checkout`) : undefined,
        blocks,
      }];
    });

  return (
    <>
      <PageTitle eyebrow="Book a tutor" title="Pick a time that works">
        Tap a shaded block to book. Your payment is held, not charged, until the quiz shows progress.
      </PageTitle>
      <BookingBoardLoader
        tutors={tutors}
        ranges={ranges}
        sessions={sessions}
        me={{ id: user.id, name: user.name }}
        family={children.map((c) => ({ id: c.id, name: c.name, isMinor: c.is_minor }))}
      />
    </>
  );
}
