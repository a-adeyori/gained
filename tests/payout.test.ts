import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSplit, normalizedGain, tutorNetCents } from '../lib/payout';

test('normalized gain scales by room to grow', () => {
  assert.equal(normalizedGain(40, 70), 0.5);
  assert.equal(normalizedGain(80, 90), 0.5);
});

test('negative gain counts as zero', () => {
  assert.equal(normalizedGain(60, 40), 0);
});

test('baseline of 90+ uses the post score itself', () => {
  assert.equal(normalizedGain(90, 80), 0.8);
  assert.equal(normalizedGain(95, 100), 1);
});

test('split adds up to the price exactly', () => {
  const s = computeSplit({ priceCents: 6000, preScore: 40, postScore: 70, retentionScore: 64, tutorAverageGain: 0 });
  assert.equal(s.baseCents, 4800);
  assert.equal(s.gainRetention, 0.4);
  // 6000 * (0.8 + 0.125*0.5 + 0.075*0.4) = 5355
  assert.equal(s.tutorPayCents, 5355);
  assert.equal(s.bonusCents, 555);
  assert.equal(s.returnedCents, 645);
  assert.equal(s.baseCents + s.bonusCents + s.returnedCents, 6000);
});

test('tanked quizzes still pay the 80% base, never less', () => {
  const s = computeSplit({ priceCents: 4999, preScore: 50, postScore: 0, retentionScore: 0, tutorAverageGain: 0 });
  assert.equal(s.bonusCents, 0);
  assert.equal(s.baseCents + s.returnedCents, 4999);
});

test('perfect gain captures the full price', () => {
  const s = computeSplit({ priceCents: 6000, preScore: 20, postScore: 100, retentionScore: 100, tutorAverageGain: 0 });
  assert.equal(s.returnedCents, 0);
});

test('skipped quizzes are scored at the tutor rolling average gain', () => {
  const s = computeSplit({ priceCents: 10000, preScore: 50, postScore: null, retentionScore: null, tutorAverageGain: 0.4 });
  // 10000 * (0.8 + 0.125*0.4 + 0.075*0.4)
  assert.equal(s.tutorPayCents, 8800);
});

test('platform fee comes off each payout', () => {
  assert.equal(tutorNetCents(4800), 4320);
});
