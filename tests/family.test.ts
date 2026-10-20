import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAddChild, decideAddParent, decideSignUp } from '../lib/family';

type Account = NonNullable<Parameters<typeof decideAddChild>[0]>;
const student = (over: Partial<Account> = {}): Account => ({ id: 'kid', role: 'student', parent_id: null, password_hash: 'hash', email_verified_at: new Date(), ...over });
const parent = (over: Partial<Account> = {}): Account => ({ id: 'mom', role: 'parent', parent_id: null, password_hash: 'hash', email_verified_at: new Date(), ...over });
const kid = { id: 'kid', email: 'kid@x.com', parent_id: null };

test('a parent adding a new email creates the child account', () => {
  assert.deepEqual(decideAddChild(null, 'mom'), { kind: 'create' });
});

test('a parent adding a student who has their own account links them straight away', () => {
  assert.deepEqual(decideAddChild(student(), 'mom'), { kind: 'link' });
  assert.deepEqual(decideAddChild(student({ password_hash: null }), 'mom'), { kind: 'link' });
});

test('whoever adds first wins: a student already in a family stays there', () => {
  assert.deepEqual(decideAddChild(student({ parent_id: 'mom' }), 'mom'), { kind: 'already-linked' });
  assert.equal(decideAddChild(student({ parent_id: 'dad' }), 'mom').kind, 'error');
  assert.equal(decideAddParent({ ...kid, parent_id: 'dad' }, 'mom@x.com', parent()).kind, 'error');
});

test('a parent can only add students', () => {
  assert.equal(decideAddChild(student({ role: 'tutor' }), 'mom').kind, 'error');
  assert.equal(decideAddChild(parent(), 'mom').kind, 'error');
});

test('a student adding an existing parent is linked; an unknown email waits for sign-up', () => {
  assert.deepEqual(decideAddParent(kid, 'mom@x.com', parent()), { kind: 'link' });
  assert.deepEqual(decideAddParent(kid, 'mom@x.com', null), { kind: 'invite' });
});

test('a student can only add a parent account, and not themselves', () => {
  assert.equal(decideAddParent(kid, 'tutor@x.com', parent({ role: 'tutor' })).kind, 'error');
  assert.equal(decideAddParent(kid, 'kid@x.com', null).kind, 'error');
});

test('signing up takes over a child account a parent created, as a student only', () => {
  assert.deepEqual(decideSignUp(null, 'student'), { kind: 'create' });
  assert.deepEqual(decideSignUp(student({ password_hash: null, parent_id: 'mom' }), 'student'), { kind: 'claim' });
  assert.equal(decideSignUp(student({ password_hash: null }), 'parent').kind, 'error');
  assert.equal(decideSignUp(student(), 'student').kind, 'error');
  assert.equal(decideSignUp(parent(), 'parent').kind, 'error');
});

test('links only reach confirmed accounts: an unconfirmed parent becomes an invite', () => {
  assert.deepEqual(decideAddParent(kid, 'mom@x.com', parent({ email_verified_at: null })), { kind: 'invite' });
});

test('a parent cannot link a student who signed up but has not confirmed their email', () => {
  assert.equal(decideAddChild(student({ email_verified_at: null }), 'mom').kind, 'error');
  // A passwordless child account another parent never claimed can't confirm anything, so it can still be linked.
  assert.deepEqual(decideAddChild(student({ password_hash: null, email_verified_at: null }), 'mom'), { kind: 'link' });
});
