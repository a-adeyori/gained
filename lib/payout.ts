// Outcome-based payout math. Pure functions, all money in integer cents so the three
// parts of a split (base, bonus, returned) always add back up to the price exactly.

export const BASE_SHARE = 0.8;
export const QUIZ_SHARE = 0.125;
export const RETENTION_SHARE = 0.075;
export const PLATFORM_FEE = 0.1;

// At or above this baseline there's too little room to grow, so the score itself is used.
export const HIGH_BASELINE = 90;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Normalized gain g = (post - pre) / (100 - pre), clamped to [0, 1]. Scores are 0–100.
 * A baseline of 90+ uses post / 100 instead, and negative gain counts as zero.
 */
export function normalizedGain(pre: number, post: number): number {
  if (pre >= HIGH_BASELINE) return clamp01(post / 100);
  return clamp01((post - pre) / (100 - pre));
}

export type SplitInput = {
  priceCents: number;
  preScore: number;
  /** null when the student skipped the quiz; scored at the tutor's rolling average gain. */
  postScore: number | null;
  retentionScore: number | null;
  tutorAverageGain: number;
};

export type Split = {
  gainQuiz: number;
  gainRetention: number;
  baseCents: number;
  bonusCents: number;
  returnedCents: number;
  /** base + bonus: what is captured from the parent's authorization. */
  tutorPayCents: number;
};

/** The guaranteed base, paid whatever the quizzes show. */
export const baseCentsFor = (priceCents: number) => Math.round(priceCents * BASE_SHARE);

export function computeSplit(input: SplitInput): Split {
  const { priceCents, preScore, postScore, retentionScore, tutorAverageGain } = input;
  const fallback = clamp01(tutorAverageGain);
  const gainQuiz = postScore === null ? fallback : normalizedGain(preScore, postScore);
  const gainRetention = retentionScore === null ? fallback : normalizedGain(preScore, retentionScore);

  const baseCents = baseCentsFor(priceCents);
  const tutorPayCents = Math.round(
    priceCents * (BASE_SHARE + QUIZ_SHARE * gainQuiz + RETENTION_SHARE * gainRetention),
  );
  return {
    gainQuiz,
    gainRetention,
    baseCents,
    bonusCents: tutorPayCents - baseCents,
    returnedCents: priceCents - tutorPayCents,
    tutorPayCents,
  };
}

/** What the tutor receives through Payouts for one capture, after the platform fee. */
export const tutorNetCents = (capturedCents: number) => Math.round(capturedCents * (1 - PLATFORM_FEE));

export const centsToValue = (cents: number) => (cents / 100).toFixed(2);
export const valueToCents = (value: string) => Math.round(Number(value) * 100);
