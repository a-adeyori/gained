// The session journey, drawn: a colour-coded stage tracker, the "your next step" card, and the
// role checklist new users see. Server-safe (no hooks).

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { AT, type NextStep, type Stage, type StageStatus } from '@/lib/journey';
import { LocalTime } from './local-time';
import { ButtonLink, cx } from './ui';

/** Puts `at`, in the viewer's time zone, where the step's text says AT. */
function withLocalTime(detail: string, at: string | undefined) {
  if (!at || !detail.includes(AT)) return detail;
  const [before, after] = detail.split(AT);
  return (
    <>
      {before}
      <LocalTime iso={at} />
      {after}
    </>
  );
}

export const STAGE_COLOR: Record<Stage, string> = {
  Booked: '#60a5fa',
  'Warm-up': '#ffb020',
  Session: '#a78bfa',
  Quiz: '#ff6b4a',
  'Check-in': '#f472b6',
  Paid: '#3ccf7f',
};

/** Six dots joined by a line; labels under each on the full size. */
export function JourneyBar({ stages, compact }: { stages: { stage: Stage; status: StageStatus }[]; compact?: boolean }) {
  const current = stages.find((s) => s.status === 'current')?.stage ?? 'Paid';
  return (
    <ol
      className={cx('flex items-start', compact ? 'gap-1' : 'gap-0')}
      aria-label={`Progress: ${current}`}
    >
      {stages.map(({ stage, status }, i) => {
        const color = STAGE_COLOR[stage];
        // A connector is coloured once the stage it leads into has been reached.
        const reached = (st: StageStatus) => st !== 'upcoming';
        const nextStage = stages[i + 1];
        return (
          <li key={stage} className={cx('flex items-center', !compact && 'flex-1 flex-col')} aria-current={status === 'current' ? 'step' : undefined}>
            <div className={cx('flex w-full items-center', !compact && 'justify-center')}>
              {!compact && (
                <span className="h-0.5 flex-1" style={{ background: i === 0 ? 'transparent' : reached(status) ? color : 'var(--line)' }} />
              )}
              <span
                className={cx(
                  'relative flex shrink-0 items-center justify-center rounded-full',
                  compact ? 'size-2.5' : 'size-7 text-xs font-bold',
                )}
                style={
                  {
                    background: status === 'upcoming' ? 'transparent' : status === 'skipped' ? 'var(--line-strong)' : color,
                    border: status === 'upcoming' ? '2px solid var(--line-strong)' : 'none',
                    color: '#121210',
                    boxShadow: status === 'current' ? `0 0 0 ${compact ? 3 : 5}px color-mix(in srgb, ${color} 30%, transparent)` : undefined,
                  } as CSSProperties
                }
                title={`${stage}: ${status}`}
              >
                {!compact && (status === 'done' ? '✓' : status === 'skipped' ? '–' : '')}
              </span>
              {!compact && (
                <span
                  className="h-0.5 flex-1"
                  style={{ background: !nextStage ? 'transparent' : reached(nextStage.status) ? STAGE_COLOR[nextStage.stage] : 'var(--line)' }}
                />
              )}
            </div>
            {!compact && (
              <span className={cx('mt-2 text-center text-xs', status === 'current' ? 'font-semibold text-ink' : 'text-muted')}>
                {stage}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The one thing to do now (bright) or who we're waiting on (quiet). */
export function NextStepCard({ step, href, context, stage }: { step: NextStep; href?: string; context?: string; stage?: Stage }) {
  const color = stage ? STAGE_COLOR[stage] : '#60a5fa';
  if (step.kind === 'wait') {
    return (
      <div className="flex items-start gap-4 rounded-3xl border border-line bg-card p-5">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg" aria-hidden="true">
          ⏳
        </span>
        <div className="min-w-0">
          {context && <p className="text-xs font-medium uppercase tracking-wider text-muted">{context}</p>}
          <p className="mt-0.5 font-medium">{step.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{withLocalTime(step.detail, step.at)}</p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="relative flex flex-col gap-4 overflow-hidden rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between"
      style={{ background: `color-mix(in srgb, ${color} 16%, var(--card))`, border: `1.5px solid color-mix(in srgb, ${color} 55%, transparent)` }}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          <span className="size-2 rounded-full" style={{ background: color }} />
          Your turn{context ? ` · ${context}` : ''}
        </p>
        <p className="mt-1.5 font-display text-2xl leading-tight tracking-tight sm:text-3xl">{step.title}</p>
        <p className="mt-1 text-ink-soft">{step.detail}</p>
      </div>
      <Link
        href={href ?? step.href}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-6 text-[15px] font-semibold text-[#121210] transition hover:opacity-90"
        style={{ background: color }}
      >
        {step.cta} →
      </Link>
    </div>
  );
}

export type GuideStep = { title: string; detail: string; done?: boolean; href?: string; cta?: string };

/** Numbered how-it-works steps for a role, ticking off what's already done. */
export function RoleGuide({ title, steps }: { title: string; steps: GuideStep[] }) {
  const colors = ['#60a5fa', '#ffb020', '#a78bfa', '#ff6b4a', '#f472b6', '#3ccf7f'];
  const nextIndex = steps.findIndex((s) => !s.done);
  return (
    <section className="rounded-3xl border border-line bg-card p-6 sm:p-8" aria-label={title}>
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const color = colors[i % colors.length];
          const isNext = i === nextIndex;
          return (
            <li
              key={s.title}
              className={cx('flex flex-col rounded-2xl border p-4 transition', isNext ? 'border-transparent' : 'border-line', s.done && 'opacity-60')}
              style={isNext ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
            >
              <span
                className="flex size-9 items-center justify-center rounded-full text-sm font-bold text-[#121210]"
                style={{ background: s.done ? 'var(--line-strong)' : color }}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <p className={cx('mt-3 font-medium', s.done && 'line-through')}>{s.title}</p>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-soft">{s.detail}</p>
              {isNext && s.href && (
                <ButtonLink href={s.href} className="mt-4 self-start px-4 text-sm">
                  {s.cta ?? 'Start'}
                </ButtonLink>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
