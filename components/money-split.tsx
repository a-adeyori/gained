'use client';

// The signature moment: one bar for the full price splits into what the tutor earned (base,
// then bonus) and what comes back to the parent, while the amounts count up.

import { useEffect, useRef, useState } from 'react';
import { formatUsd } from '@/lib/escrow-states';

type Props = {
  priceCents: number;
  baseCents: number;
  bonusCents: number;
  returnedCents: number;
  /** Bonus and returned are estimates until the retention quiz settles. */
  provisional?: boolean;
  /** Animate on mount (and when scrolled into view). Off for static thumbnails. */
  animate?: boolean;
  className?: string;
};

const DURATION_MS = 1600;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function useProgress(animate: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(frame);
    }
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        setProgress(easeOutCubic(t));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          // A short beat so the eye lands on the bar before it splits.
          setTimeout(run, 250);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [animate]);

  return { ref, progress };
}

export function MoneySplit({ priceCents, baseCents, bonusCents, returnedCents, provisional, animate = true, className }: Props) {
  const { ref, progress } = useProgress(animate);
  const pct = (cents: number) => (priceCents ? (cents / priceCents) * 100 : 0);

  // The bar starts whole (neutral, "held"), then the segments grow in from the left in
  // order: base, bonus, returned. Each segment's share of the animation is staggered.
  const stage = (from: number, to: number) => Math.min(1, Math.max(0, (progress - from) / (to - from)));
  const baseT = stage(0, 0.55);
  const bonusT = stage(0.35, 0.8);
  const returnedT = stage(0.55, 1);

  const segments = [
    { key: 'base', label: 'Base to tutor', cents: baseCents, t: baseT, color: 'var(--state-base)' },
    { key: 'bonus', label: 'Learning bonus', cents: bonusCents, t: bonusT, color: 'var(--gain)' },
    { key: 'returned', label: 'Back to you', cents: returnedCents, t: returnedT, color: 'var(--state-returned)' },
  ];

  return (
    <div ref={ref} className={className}>
      <div className="mb-2 flex items-baseline justify-between text-sm text-muted">
        <span>Session price</span>
        <span className="num font-medium text-ink">{formatUsd(priceCents)}</span>
      </div>

      <div
        className="relative flex h-14 w-full overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line"
        role="img"
        aria-label={`${formatUsd(baseCents)} base to the tutor, ${formatUsd(bonusCents)} learning bonus, ${formatUsd(returnedCents)} back to you`}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full transition-[filter] first:rounded-l-2xl last:rounded-r-2xl"
            style={{
              width: `${pct(s.cents) * s.t}%`,
              background: s.color,
              opacity: s.key !== 'base' && provisional ? 0.75 : 1,
              backgroundImage:
                s.key !== 'base' && provisional
                  ? 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(255,255,255,.18) 8px 16px)'
                  : undefined,
            }}
          />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {segments.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted sm:text-sm">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.label}
            </dt>
            <dd className="num mt-0.5 text-lg font-semibold tracking-tight sm:text-2xl">
              {formatUsd(Math.round(s.cents * s.t))}
            </dd>
          </div>
        ))}
      </dl>
      {provisional && (
        <p className="mt-3 text-xs text-muted">Bonus and return are estimates until the 48-hour check-in quiz. Striped means not final.</p>
      )}
    </div>
  );
}
