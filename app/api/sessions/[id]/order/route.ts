// POST: create (or reuse) the PayPal order that will hold this session's full price.
// Only the session's payer may call it; the price always comes from the database.

import { ensureStillBookable } from '@/app/(app)/book/queries';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createBookingOrder } from '@/lib/escrow';

export async function POST(_req: Request, ctx: RouteContext<'/api/sessions/[id]/order'>) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  const session = await db.session.findUnique({ where: { id }, include: { escrow: true } });
  if (!session) return Response.json({ error: 'Session not found.' }, { status: 404 });
  if (session.payer_id !== user.id) return Response.json({ error: 'Only the person paying can check out.' }, { status: 403 });
  if (session.escrow) {
    return Response.json({ error: 'This session’s payment is already held.', state: session.escrow.state }, { status: 409 });
  }

  const check = await ensureStillBookable(session);
  if (!check.ok) return Response.json({ error: check.error }, { status: 409 });

  try {
    return Response.json({ orderId: await createBookingOrder(id) });
  } catch (err) {
    console.error(`Creating PayPal order for session ${id} failed`, err);
    return Response.json({ error: 'PayPal didn’t respond. Nothing was charged; please try again.' }, { status: 502 });
  }
}
