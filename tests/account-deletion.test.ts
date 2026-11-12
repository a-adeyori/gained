import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteChildAccount, canDeleteOwnAccount, moneyInFlightReason } from '../lib/account-deletion';

type Account = Parameters<typeof canDeleteOwnAccount>[0];
const user = (role: Account['role'], over: Partial<Account> = {}): Account => ({ id: role, role, parent_id: null, ...over });

test('parents, tutors and students nobody manages can delete their own account', () => {
  assert.equal(canDeleteOwnAccount(user('parent')).ok, true);
  assert.equal(canDeleteOwnAccount(user('tutor')).ok, true);
  assert.equal(canDeleteOwnAccount(user('student')).ok, true);
});

test('a student in a family can’t delete their own account, and admins can’t either', () => {
  assert.equal(canDeleteOwnAccount(user('student', { parent_id: 'mom' })).ok, false);
  assert.equal(canDeleteOwnAccount(user('admin')).ok, false);
});

test('a parent can delete only their own child’s account', () => {
  const mom = user('parent', { id: 'mom' });
  assert.equal(canDeleteChildAccount(mom, user('student', { id: 'kid', parent_id: 'mom' })).ok, true);
  assert.equal(canDeleteChildAccount(mom, user('student', { id: 'kid', parent_id: 'dad' })).ok, false);
  assert.equal(canDeleteChildAccount(mom, user('student', { id: 'kid' })).ok, false);
  assert.equal(canDeleteChildAccount(mom, user('tutor', { id: 't', parent_id: 'mom' })).ok, false);
  assert.equal(canDeleteChildAccount(mom, null).ok, false);
});

test('only a parent can delete someone else’s account', () => {
  const kid = user('student', { id: 'kid', parent_id: 'tut' });
  assert.equal(canDeleteChildAccount(user('tutor', { id: 'tut' }), kid).ok, false);
  assert.equal(canDeleteChildAccount(user('student', { id: 'tut' }), kid).ok, false);
});

test('the wait message counts the sessions with money held', () => {
  assert.match(moneyInFlightReason(1, true), /^You have 1 session with/);
  assert.match(moneyInFlightReason(3, false), /^They have 3 sessions with/);
});
