// Database reads shared by booking, availability and checkout. Server-only.

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { checkStillBookable, type SessionSlot } from '@/lib/booking';

const DAY = 24 * 3600_000;

/** A tutor's sessions within a day either side of a time range, in the shape lib/booking checks. */
export async function tutorSessionsAround(
  tutorId: string,
  start: Date,
  end: Date,
  client: Prisma.TransactionClient = db,
): Promise<(SessionSlot & { id: string })[]> {
  const rows = await client.session.findMany({
    where: {
      tutor_id: tutorId,
      status: { not: 'cancelled' },
      start_at: { lt: new Date(end.getTime() + DAY) },
      end_at: { gt: new Date(start.getTime() - DAY) },
    },
    select: { id: true, start_at: true, end_at: true, status: true, created_at: true, escrow: { select: { session_id: true } } },
  });
  return rows.map(({ escrow, ...s }) => ({ ...s, has_escrow: escrow !== null }));
}

/**
 * Before a hold is placed on a booking that isn't approved yet: re-check the slot. A booking
 * that can no longer go ahead is cancelled so it stops showing up anywhere.
 */
export async function ensureStillBookable(session: { id: string; tutor_id: string; start_at: Date; end_at: Date; status: string; created_at: Date }) {
  const others = await tutorSessionsAround(session.tutor_id, session.start_at, session.end_at);
  const check = checkStillBookable({ ...session, has_escrow: false }, others, new Date());
  if (!check.ok && session.status !== 'cancelled') {
    await db.session.update({ where: { id: session.id }, data: { status: 'cancelled' } });
  }
  return check;
}
