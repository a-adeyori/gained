import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retentionAction, retentionClosesAt } from '../lib/retention';

const ended = new Date('2026-10-20T18:00:00Z');
const at = (hoursAfterEnd: number) => new Date(ended.getTime() + hoursAfterEnd * 3_600_000);
const blank = { sessionEndedAt: ended, sent_at: null, closes_at: null, completed_at: null };

test('waits until 48 hours after the session ends', () => {
  assert.equal(retentionAction(blank, at(47.9)), 'wait');
  assert.equal(retentionAction(blank, at(48)), 'send');
});

test('closes 12 hours after it is sent', () => {
  assert.deepEqual(retentionClosesAt(at(48)), at(60));
  const sent = { ...blank, sent_at: at(48), closes_at: at(60) };
  assert.equal(retentionAction(sent, at(59.9)), 'wait');
  assert.equal(retentionAction(sent, at(60)), 'settle-expired');
});

test('a completed quiz settles right away', () => {
  const done = { ...blank, sent_at: at(48), closes_at: at(60), completed_at: at(50) };
  assert.equal(retentionAction(done, at(50.1)), 'settle-completed');
});

test('settles only after the appeal window, with retention resolved and no open appeal', async () => {
  const { readyToSettle } = await import('../lib/retention');
  const retention = { ...blank, sent_at: at(48), closes_at: at(60), completed_at: at(52), graded: true };
  const input = { sessionEndedAt: ended, escrowState: 'awaiting_retention', retention, openAppeals: 0 };
  assert.equal(readyToSettle({ ...input, now: at(71) }), false);
  assert.equal(readyToSettle({ ...input, now: at(72) }), true);
  assert.equal(readyToSettle({ ...input, now: at(80), openAppeals: 1 }), false);
  assert.equal(readyToSettle({ ...input, now: at(80), escrowState: 'held' }), false);
  assert.equal(readyToSettle({ ...input, now: at(80), retention: { ...retention, graded: false } }), false);
  const unanswered = { ...blank, sent_at: at(48), closes_at: at(60), graded: false };
  assert.equal(readyToSettle({ ...input, now: at(72), retention: unanswered }), true);
  assert.equal(readyToSettle({ ...input, now: at(72), retention: null }), true);
});
