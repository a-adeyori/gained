// Live pilot numbers for the landing page's proof strip, read from finished escrows.
// Returns null until there are enough real (non-seed) settled sessions to say anything honest.

export type PilotStats = {
  settledSessions: number;
  /** Mean post-session normalized gain, 0-1. */
  averageGain: number;
  /** Mean amount returned to the parent per session, in cents. */
  averageReturnedCents: number;
  /** Share of sessions whose 48-hour retention quiz still showed a gain, 0-1. */
  positiveRetentionShare: number;
};

const MIN_SESSIONS = 3;
const TIMEOUT_MS = 3000;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

async function readStats(): Promise<PilotStats | null> {
  // Imported lazily: lib/db throws at import time when DATABASE_URL is missing.
  const { db } = await import('./db');
  const { normalizedGain } = await import('./payout');
  const escrows = await db.escrow.findMany({
    where: { state: { in: ['settled', 'returned'] }, session: { is_seed: false } },
    select: {
      returned_cents: true,
      session: { select: { result: { select: { pre_score: true, post_score: true, retention_score: true } } } },
    },
  });
  if (escrows.length < MIN_SESSIONS) return null;

  // Gains are recomputed from measured scores only. The stored gains can hold the tutor's
  // average when a quiz was skipped, and an estimate must never pass as a pilot result.
  const results = escrows.map((e) => e.session.result);
  const gains = results.flatMap((r) =>
    r?.pre_score != null && r.post_score != null ? [normalizedGain(r.pre_score, r.post_score)] : [],
  );
  const retention = results.flatMap((r) =>
    r?.pre_score != null && r.retention_score != null ? [normalizedGain(r.pre_score, r.retention_score)] : [],
  );
  const returned = escrows.flatMap((e) => (e.returned_cents != null ? [e.returned_cents] : []));
  if (gains.length < MIN_SESSIONS || !retention.length || !returned.length) return null;

  return {
    settledSessions: escrows.length,
    averageGain: mean(gains),
    averageReturnedCents: Math.round(mean(returned)),
    positiveRetentionShare: retention.filter((g) => g > 0).length / retention.length,
  };
}

export async function getPilotStats(): Promise<PilotStats | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    // The landing page must never hang on an unreachable database.
    return await Promise.race([
      readStats(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.error('pilot stats unavailable', error);
    return null;
  }
}
