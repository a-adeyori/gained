import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { captureEscrow, type EscrowAuthPatch } from '../lib/paypal';

process.env.PAYPAL_CLIENT_ID = 'test-id';
process.env.PAYPAL_SECRET = 'test-secret';

// A fake PayPal that records every call and can be told to reject reauthorizations.
let calls: string[] = [];
let failReauthorize = false;

beforeEach(() => {
  calls = [];
  failReauthorize = false;
  globalThis.fetch = (async (input: string | URL) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (path === '/v1/oauth2/token') return json(200, { access_token: 'token', expires_in: 3600 });
    if (path.endsWith('/reauthorize')) {
      return failReauthorize ? json(422, { name: 'UNPROCESSABLE_ENTITY' }) : json(201, { id: 'AUTH-NEW', status: 'CREATED' });
    }
    if (path.endsWith('/capture')) return json(201, { id: 'CAP-1', status: 'COMPLETED', amount: { value: '48.00', currency_code: 'USD' } });
    return json(404, {});
  }) as typeof fetch;
});

const now = new Date('2026-10-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const escrow = (authorizedHoursAgo: number, reauthorized = false) => ({
  session_id: 's1',
  authorization_id: 'AUTH-OLD',
  authorized_at: hoursAgo(authorizedHoursAgo),
  reauthorized,
});
const capturePaths = () => calls.filter((p) => p.endsWith('/capture'));
const reauthCount = () => calls.filter((p) => p.endsWith('/reauthorize')).length;

async function capture(e: ReturnType<typeof escrow>) {
  const saved: EscrowAuthPatch[] = [];
  const result = await captureEscrow(e, {
    amountCents: 4800,
    finalCapture: false,
    key: 'session-s1-base',
    holdCents: 6000,
    save: async (patch) => void saved.push(patch),
    now,
  });
  return { ...result, saved };
}

test('a hold 72 hours old or younger is captured as is', async () => {
  const { saved } = await capture(escrow(72));
  assert.equal(reauthCount(), 0);
  assert.deepEqual(saved, []);
  assert.deepEqual(capturePaths(), ['/v2/payments/authorizations/AUTH-OLD/capture']);
});

test('an older hold is reauthorized, saved, then captured on the new ID', async () => {
  const { saved, escrow: after } = await capture(escrow(73));
  assert.equal(reauthCount(), 1);
  assert.deepEqual(saved, [{ authorization_id: 'AUTH-NEW', authorized_at: now, reauthorized: true }]);
  assert.equal(after.authorization_id, 'AUTH-NEW');
  assert.deepEqual(capturePaths(), ['/v2/payments/authorizations/AUTH-NEW/capture']);
});

test('a session is never reauthorized twice', async () => {
  await capture(escrow(100, true));
  assert.equal(reauthCount(), 0);
  assert.deepEqual(capturePaths(), ['/v2/payments/authorizations/AUTH-OLD/capture']);
});

test('a failed reauthorization is logged and the capture still runs on the original hold', async () => {
  failReauthorize = true;
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    const { saved, escrow: after } = await capture(escrow(80));
    assert.equal(errors.length, 1);
    assert.deepEqual(saved, []);
    assert.equal(after.reauthorized, false);
    assert.deepEqual(capturePaths(), ['/v2/payments/authorizations/AUTH-OLD/capture']);
  } finally {
    console.error = original;
  }
});
