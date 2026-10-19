'use client';

// Learning gain over time as small multiples: one panel per subject (per student and subject when
// a family has several children), each a single gain-green line on a shared 0-100% scale and a
// shared time range, so panels compare at a glance without a legend. Hovering or focusing a
// point shows that session; the session list below the chart is the table view of the same data.

import { useState } from 'react';

export type GainPoint = {
  sessionId: string;
  /** ISO timestamp of the session start. */
  at: string;
  gain: number;
  pre: number | null;
  post: number | null;
  tutor: string;
};

export type GainSeries = { key: string; title: string; points: GainPoint[] };

const W = 320;
const H = 150;
const PAD = { top: 14, right: 40, bottom: 22, left: 34 };
const TICKS = [0, 50, 100];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const pct = (gain: number) => `${Math.round(gain * 100)}%`;

export function GainChart({ series }: { series: GainSeries[] }) {
  const times = series.flatMap((s) => s.points.map((p) => new Date(p.at).getTime()));
  const min = Math.min(...times);
  const max = Math.max(...times);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {series.map((s) => (
        <Panel key={s.key} series={s} min={min} max={max} />
      ))}
    </div>
  );
}

function Panel({ series, min, max }: { series: GainSeries; min: number; max: number }) {
  const [active, setActive] = useState<number | null>(null);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (iso: string) =>
    max === min ? PAD.left + plotW / 2 : PAD.left + ((new Date(iso).getTime() - min) / (max - min)) * plotW;
  const y = (gain: number) => PAD.top + (1 - gain) * plotH;

  const pts = series.points.map((p) => ({ ...p, cx: x(p.at), cy: y(p.gain) }));
  const last = pts.at(-1);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const hovered = active === null ? null : pts[active];

  return (
    <figure className="rounded-2xl border border-line bg-card p-4">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-medium">{series.title}</span>
        <span className="text-xs text-muted">
          {series.points.length} {series.points.length === 1 ? 'session' : 'sessions'}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={`Learning gain in ${series.title}, ${series.points.map((p) => `${shortDate(p.at)}: ${pct(p.gain)}`).join('; ')}`}
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t / 100)} y2={y(t / 100)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t / 100)} dy="0.32em" textAnchor="end" className="num fill-muted text-[10px]">
                {t}%
              </text>
            </g>
          ))}
          {pts.length > 0 && (
            <>
              <text x={PAD.left} y={H - 6} className="fill-muted text-[10px]">
                {shortDate(new Date(min).toISOString())}
              </text>
              {max !== min && (
                <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted text-[10px]">
                  {shortDate(new Date(max).toISOString())}
                </text>
              )}
            </>
          )}
          {pts.length > 1 && (
            <path d={path} fill="none" stroke="var(--gain)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {pts.map((p, i) => (
            <circle
              key={p.sessionId}
              cx={p.cx}
              cy={p.cy}
              r={active === i ? 5 : 4}
              fill="var(--gain)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
          {last && (
            <text x={last.cx + 9} y={last.cy} dy="0.32em" className="num fill-ink text-[11px] font-medium">
              {pct(last.gain)}
            </text>
          )}
          {/* Hit targets larger than the dots, focusable for keyboard readers. */}
          {pts.map((p, i) => (
            <circle
              key={`hit-${p.sessionId}`}
              cx={p.cx}
              cy={p.cy}
              r={12}
              fill="transparent"
              tabIndex={0}
              aria-label={`${shortDate(p.at)}: ${pct(p.gain)} learning gain`}
              className="cursor-pointer outline-none"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          ))}
        </svg>
        {hovered && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-max max-w-[12rem] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm"
            style={{ left: `${(hovered.cx / W) * 100}%`, top: `calc(${(hovered.cy / H) * 100}% - 10px)` }}
          >
            <p className="font-medium">{shortDate(hovered.at)} · {hovered.tutor}</p>
            <p className="num mt-0.5 text-ink-soft">
              {hovered.pre !== null && hovered.post !== null && (
                <>
                  {Math.round(hovered.pre)}% → {Math.round(hovered.post)}% ·{' '}
                </>
              )}
              <span className="font-medium text-gain-ink">{pct(hovered.gain)} gain</span>
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
