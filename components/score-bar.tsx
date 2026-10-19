'use client';

// The score bar fills from the baseline to the post-quiz score (the second of the two animated
// moments), with the 48-hour retention score marked once it exists.

import { useEffect, useState } from 'react';

type Props = { pre: number; post: number; retention?: number | null };

export function ScoreBar({ pre, post, retention }: Props) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 200);
    return () => clearTimeout(t);
  }, []);
  const gainPts = Math.round(post - pre);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Before</p>
          <p className="num text-4xl font-semibold tracking-tight">{Math.round(pre)}%</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">After</p>
          <p className="num text-4xl font-semibold tracking-tight text-gain-ink">{Math.round(post)}%</p>
        </div>
      </div>
      <div
        className="relative mt-3 h-4 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"
        role="img"
        aria-label={`Score went from ${Math.round(pre)}% to ${Math.round(post)}%${retention != null ? `, and ${Math.round(retention)}% after 48 hours` : ''}`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-line-strong" style={{ width: `${pre}%` }} />
        <div
          className="absolute inset-y-0 rounded-r-full bg-gain transition-[width] duration-[1400ms] ease-out"
          style={{ left: `${pre}%`, width: filled ? `${Math.max(0, post - pre)}%` : '0%' }}
        />
        {retention != null && (
          <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${retention}%` }} title={`48 hours later: ${Math.round(retention)}%`} />
        )}
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        {gainPts > 0 ? (
          <>
            <span className="num font-semibold text-gain-ink">+{gainPts} points</span> in one session
          </>
        ) : (
          'No measured gain on this quiz'
        )}
        {retention != null && (
          <span className="text-muted">
            {' '}
            · <span className="num">{Math.round(retention)}%</span> after 48 hours
          </span>
        )}
      </p>
    </div>
  );
}
