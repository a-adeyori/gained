import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLink, sign, signLink, verify } from '../lib/signing';

// The secret is read when a token is made or checked, so setting it here is early enough.
process.env.SESSION_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';

test('an emailed link round-trips its data until it expires', () => {
  const token = signLink('verify', { uid: 'u1', email: 'a@b.co' }, 60_000);
  assert.deepEqual(
    { ...readLink<{ uid: string; email: string }>('verify', token) },
    { uid: 'u1', email: 'a@b.co', exp: readLink<{ exp: number }>('verify', token)!.exp },
  );
  assert.equal(readLink('verify', token, Date.now() + 61_000), null);
});

test('a link only works for its own purpose', () => {
  const token = signLink('verify', { uid: 'u1' }, 60_000);
  assert.equal(readLink('reset', token), null);
});

test('a link can never pass as a sign-in cookie, nor a cookie as a link', () => {
  const link = signLink('verify', { uid: 'u1' }, 60_000);
  assert.equal(verify(link), null);
  const cookie = sign({ uid: 'u1', exp: Date.now() + 60_000 });
  assert.equal(readLink('verify', cookie), null);
});

test('a tampered link is rejected', () => {
  const [payload, sig] = signLink('verify', { uid: 'u1' }, 60_000).split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'admin', exp: Date.now() + 60_000 })).toString('base64url');
  assert.equal(readLink('verify', `${forged}.${sig}`), null);
  assert.equal(readLink('verify', `${payload}.x${sig.slice(1)}`), null);
});
