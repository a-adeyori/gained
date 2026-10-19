// The worked example used across the landing page: a $60 session, computed with the real
// payout formula so the page can never drift from what the product actually pays.

import { computeSplit } from '@/lib/payout';

const priceCents = 6000;
const pre = 40;
const post = 70;
const retention = 64;

const split = computeSplit({
  priceCents,
  preScore: pre,
  postScore: post,
  retentionScore: retention,
  tutorAverageGain: 0,
});

export const EXAMPLE = {
  priceCents,
  pre,
  post,
  retention,
  gainQuiz: split.gainQuiz,
  gainRetention: split.gainRetention,
  baseCents: split.baseCents,
  bonusCents: split.bonusCents,
  returnedCents: split.returnedCents,
};
