// POST: after the payer approves in PayPal, place the hold, open the escrow and start
// writing the baseline quiz. Idempotent: a second call returns the existing escrow state.

import { ensureStillBookable } from '@/app/(app)/book/queries';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { authorizeBooking } from '@/lib/escrow';
import { startJob } from '@/lib/jobs';
import { notifyBooked } from '@/lib/notify';

export async function POST(req: Request, ctx: RouteContext<'/api/sessions/[id]/authorize'>) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  const session = await db.session.findUnique({ where: { id }, include: { escrow: true } });
  if (!session) return Response.json({ error: 'Session not found.' }, { status: 404 });
  if (session.payer_id !== user.id) return Response.json({ error: 'Only the person paying can approve the hold.' }, { status: 403 });
  if (session.escrow) return Response.json({ state: session.escrow.state });

  if (!session.paypal_order_id) return Response.json({ error: 'Start checkout again; there’s no PayPal order yet.' }, { status: 409 });
  // The button reports the order it approved; it must be this session's order.
  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  if (typeof body.orderId === 'string' && body.orderId !== session.paypal_order_id) {
    return Response.json({ error: 'That PayPal approval belongs to a different checkout. Nothing was charged.' }, { status: 409 });
  }

  const check = await ensureStillBookable(session);
  if (!check.ok) return Response.json({ error: check.error }, { status: 409 });

  let escrow;
  try {
    escrow = await authorizeBooking(id);
  } catch (err) {
    // A double-submitted approval can lose the race to create the escrow row; that's a success.
    const existing = await db.escrow.findUnique({ where: { session_id: id } });
    if (existing) return Response.json({ state: existing.state });
    console.error(`Authorizing session ${id} failed`, err);
    return Response.json(
      { error: 'PayPal couldn’t place the hold. Nothing was charged; please try again or use another payment method.' },
      { status: 502 },
    );
  }

  await notifyBooked(id);

  // The hold is in place either way; a failed job start is logged, not shown to the parent.
  try {
    await startJob('writeBaseline', id);
  } catch (err) {
    console.error(`Starting writeBaseline for session ${id} failed`, err);
  }
  return Response.json({ state: escrow.state });
}
