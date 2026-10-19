// The tutor dashboard's data source: AG Studio's getData (app/(app)/tutor/dashboard/studio/data.ts)
// fetches the signed-in tutor's sessions, earnings and topic gains from here. Never another
// tutor's: the rows are scoped to the cookie's user, whatever the request says.

import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildTutorStudioData } from '@/lib/studio-data';

const error = (status: number, message: string) => Response.json({ error: { message } }, { status });

export async function GET() {
  const user = await currentUser();
  if (!user) return error(401, 'Sign in to see your dashboard.');
  if (user.role !== 'tutor') return error(403, 'The dashboard is for tutors.');

  // Only sessions with a hold placed: a booking whose PayPal approval never happened cost nothing.
  const sessions = await db.session.findMany({
    where: { tutor_id: user.id, escrow: { isNot: null } },
    include: { student: { select: { name: true } }, escrow: true, result: true },
    orderBy: { start_at: 'asc' },
  });
  return Response.json(buildTutorStudioData(sessions), { headers: { 'Cache-Control': 'private, no-store' } });
}
