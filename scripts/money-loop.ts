// End-to-end sandbox test of the escrow loop. Prints every ID and state along the way.
//
//   npm run money-loop
//       authorize, capture the 80% base (final_capture false), reauthorize,
//       then capture the bonus (final_capture true) on the new authorization
//   npm run money-loop -- --no-bonus
//       authorize, capture the base, void the remainder
//   npm run money-loop -- --base-only
//       authorize and capture the base, then stop, leaving the rest of the hold for --resume
//   npm run money-loop -- --resume <authorization_id>
//       for a --base-only hold that is now more than 72 hours old: capture the bonus through
//       the production path, which reauthorizes first
//
// PayPal only allows reauthorizing after the 3-day honor period, so the reauthorization in
// a same-day run may be refused for that reason alone. Start a --base-only hold today and
// --resume it on day 4 to test reauthorizing after a partial capture for real.
//
// Needs PAYPAL_CLIENT_ID and PAYPAL_SECRET in .env.local. Set TUTOR_PAYPAL_EMAIL to a
// sandbox personal account to also test Payouts.

import {
  authorizeOrder,
  captureEscrow,
  createAuthorizeOrder,
  createPayout,
  getAuthorization,
  getOrder,
  reauthorize,
  voidAuthorization,
  type EscrowAuth,
} from '../lib/paypal';
import { centsToValue, computeSplit, tutorNetCents } from '../lib/payout';

const args = process.argv.slice(2);
const noBonus = args.includes('--no-bonus');
const baseOnly = args.includes('--base-only');
const resumeId = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : undefined;
const priceCents = 6000;
const split = noBonus
  ? computeSplit({ priceCents, preScore: 50, postScore: 40, retentionScore: 30, tutorAverageGain: 0 })
  : computeSplit({ priceCents, preScore: 40, postScore: 70, retentionScore: 64, tutorAverageGain: 0 });
const remainingCents = priceCents - split.baseCents;

const log = (label: string, value: unknown) => console.log(`${label.padEnd(24)} ${value}`);
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
// The script has no database, so "saving" an escrow update just prints it.
const save = async (patch: Partial<EscrowAuth>) => log('escrow saved', JSON.stringify(patch));

async function waitForApproval(orderId: string) {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    if ((await getOrder(orderId)).status === 'APPROVED') return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Order was not approved within 10 minutes');
}

async function captureBonus(escrow: EscrowAuth) {
  const { escrow: after, capture } = await captureEscrow(escrow, {
    amountCents: split.bonusCents,
    finalCapture: true,
    key: `session-${escrow.session_id}-bonus`,
    holdCents: remainingCents,
    save,
  });
  log('bonus capture', `${capture.id} ${capture.status} $${capture.amount.value} on ${after.authorization_id}`);
  log('authorization status', (await getAuthorization(after.authorization_id)).status);
  return after;
}

async function payTutor(sessionId: string) {
  const tutorEmail = process.env.TUTOR_PAYPAL_EMAIL;
  if (!tutorEmail) {
    console.log('\nTUTOR_PAYPAL_EMAIL not set; skipping payouts.');
    return;
  }
  for (const [part, cents] of [['base', split.baseCents], ['bonus', split.bonusCents]] as const) {
    if (cents === 0) continue;
    const payout = await createPayout({
      senderBatchId: `session-${sessionId}-${part}`,
      receiverEmail: tutorEmail,
      amountCents: tutorNetCents(cents),
      note: `Gained session ${sessionId}: ${part}`,
    });
    log(`payout (${part})`, `${payout.batch_header.payout_batch_id} ${payout.batch_header.batch_status} $${centsToValue(tutorNetCents(cents))}`);
  }
}

// Day 4+: the hold is past 72 hours, so captureEscrow reauthorizes before capturing.
async function resume(authorizationId: string) {
  const auth = await getAuthorization(authorizationId);
  log('authorization', `${auth.id} ${auth.status} (created ${auth.create_time})`);
  if (!auth.create_time) throw new Error('PayPal returned no create_time for this authorization');
  const escrow: EscrowAuth = {
    session_id: `resume-${authorizationId}`,
    authorization_id: auth.id,
    authorized_at: new Date(auth.create_time),
    reauthorized: false,
  };
  const after = await captureBonus(escrow);
  if (!after.reauthorized) {
    console.log('\nSTOP: the hold was not reauthorized before the bonus capture (see the error above, if any).');
    console.log('Nothing should be built on reauthorize-after-partial-capture until this works.');
    process.exitCode = 2;
  }
}

async function main() {
  if (resumeId) return resume(resumeId);

  const sessionId = `test-${Date.now()}`;
  log('session', sessionId);
  log('price', `$${centsToValue(priceCents)}`);
  log('planned split', `base $${centsToValue(split.baseCents)}, bonus $${centsToValue(split.bonusCents)}, returned $${centsToValue(split.returnedCents)}`);

  // 1. Booking
  const { orderId, approveUrl } = await createAuthorizeOrder({
    sessionId,
    priceCents,
    description: 'Gained tutoring session (test)',
    returnUrl: 'https://example.com/approved',
    cancelUrl: 'https://example.com/cancelled',
  });
  log('order', orderId);
  console.log(`\nApprove with a sandbox personal account, then come back here:\n  ${approveUrl}\n`);
  await waitForApproval(orderId);
  log('order status', 'APPROVED');

  const auth = await authorizeOrder(orderId);
  log('authorization', auth.id);
  log('authorization status', `${auth.status} (expires ${auth.expiration_time ?? '?'})`);
  let escrow: EscrowAuth = { session_id: sessionId, authorization_id: auth.id, authorized_at: new Date(), reauthorized: false };

  // 2. Right after the session: the guaranteed base, more captures to come.
  const base = await captureEscrow(escrow, {
    amountCents: split.baseCents,
    finalCapture: false,
    key: `session-${sessionId}-base`,
    holdCents: priceCents,
    save,
  });
  escrow = base.escrow;
  log('base capture', `${base.capture.id} ${base.capture.status} $${base.capture.amount.value}`);
  log('authorization status', (await getAuthorization(auth.id)).status);

  if (baseOnly) {
    const resumeAfter = new Date(escrow.authorized_at.getTime() + 72 * 3_600_000);
    console.log(`
Hold left open. After ${resumeAfter.toISOString()}, run:`);
    console.log(`  npm run money-loop -- --resume ${auth.id}`);
    return;
  }

  if (split.bonusCents === 0) {
    await voidAuthorization(auth.id, `session-${sessionId}-void`);
    log('void', 'remainder released');
    log('authorization status', (await getAuthorization(auth.id)).status);
    log('returned to parent', `$${centsToValue(split.returnedCents)}`);
    return payTutor(sessionId);
  }

  // 3. Reauthorize the partially captured hold, as a hold older than 72 hours would be.
  let reauthFailed = false;
  try {
    const fresh = await reauthorize(auth.id, remainingCents, `session-${sessionId}-reauthorize`);
    escrow = { ...escrow, authorization_id: fresh.id, authorized_at: new Date(), reauthorized: true };
    log('reauthorization', `${fresh.id} ${fresh.status} (expires ${fresh.expiration_time ?? '?'})`);
  } catch (err) {
    reauthFailed = true;
    log('reauthorization', `FAILED: ${message(err)}`);
  }

  // 4. After the retention quiz: the bonus with final_capture, which releases the rest.
  //    After a failed reauthorization this captures on the original hold, as production would.
  await captureBonus(escrow);
  log('returned to parent', `$${centsToValue(split.returnedCents)}`);
  await payTutor(sessionId);

  if (reauthFailed) {
    console.log('\nSTOP: reauthorizing after a partial capture failed in sandbox (error above).');
    console.log('If PayPal refused it because the hold is inside its 3-day honor period, start a hold');
    console.log('today with --base-only and finish it on day 4 with --resume <authorization_id>.');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`\nFAILED: ${message(err)}`);
  process.exit(1);
});
