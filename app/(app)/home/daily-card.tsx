'use client';

// The student's streak and problem of the day. The day is the student's local date (the server
// can't know their time zone); the server action checks it's plausible and grades the answer.

import { useState, useSyncExternalStore, useTransition, type CSSProperties } from 'react';
import { renderMath } from '@/components/math-text';
import { cx } from '@/components/ui';
import { dayNumber, localDayKey, previousDay, problemFor, streaks } from '@/lib/daily';
import { answerDaily } from './daily-actions';
import s from './daily.module.css';

export type Attempt = { day: string; picks: number[]; solved: boolean };

const pad = (n: number) => String(n).padStart(2, '0');
const subscribeClock = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
const useClock = () =>
  useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DailyCard({ name, attempts, solvedDays }: { name: string; attempts: Attempt[]; solvedDays: string[] }) {
  const now = useClock();
  const [records, setRecords] = useState(() => new Map(attempts.map((a) => [a.day, a])));
  const [solved, setSolved] = useState(solvedDays);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [shake, setShake] = useState(0);
  const [pending, startTransition] = useTransition();

  if (now === 0) return <div className="h-[34rem] animate-pulse rounded-[1.75rem] bg-surface-2" />;

  const date = new Date(now * 1000);
  const today = localDayKey(date);
  const problem = problemFor(today);
  const record = records.get(today) ?? { day: today, picks: [], solved: false };
  const { current, best } = streaks(solved, today);
  const tries = record.picks.length;

  const midnight = new Date(date);
  midnight.setHours(24, 0, 0, 0);
  const left = Math.max(0, Math.floor(midnight.getTime() / 1000) - now);
  const countdown = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;

  // The last seven days, oldest first, for the dots.
  const week: string[] = [today];
  while (week.length < 7) week.unshift(previousDay(week[0]));
  const solvedSet = new Set(solved);

  const pick = (i: number) => {
    if (pending || record.solved || record.picks.includes(i)) return;
    setError(null);
    startTransition(async () => {
      const res = await answerDaily(today, i);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRecords((m) => new Map(m).set(res.day, { day: res.day, picks: res.picks, solved: res.solved }));
      setSolved(res.solvedDays);
      if (res.solved) setBurst((b) => b + 1);
      else setShake((x) => x + 1);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <section className={cx(s.streak, current === 0 && s.cold, 'p-6 sm:p-8')} aria-label="Your streak">
        <div className="relative flex h-full flex-col">
          <p className="text-sm font-semibold">Hi {name} 👋</p>
          <p className="mt-6 font-display text-[7rem] leading-[0.8] tracking-tight sm:text-[9rem]">
            <span className="num">{current}</span>
            {current > 0 && (
              <span className={cx(s.flame, 'ml-2 align-top text-6xl')} aria-hidden="true">
                🔥
              </span>
            )}
          </p>
          <p className="mt-2 text-lg font-medium">
            {current === 0 ? 'Solve today’s problem to start a streak.' : current === 1 ? 'day streak' : 'day streak. Keep it going.'}
          </p>
          <div className={cx(s.week, 'mt-8')} aria-label="Last seven days">
            {week.map((d) => (
              <span
                key={d}
                data-on={solvedSet.has(d) || undefined}
                data-today={d === today || undefined}
                title={d}
              >
                {WEEKDAY[new Date(`${d}T12:00:00`).getDay()]}
              </span>
            ))}
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-4 pt-8">
            <div>
              <dt className="text-sm opacity-70">Best streak</dt>
              <dd className="num text-3xl font-semibold">{best}</dd>
            </div>
            <div>
              <dt className="text-sm opacity-70">Next problem in</dt>
              <dd className="num text-3xl font-semibold">{countdown}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-card p-6 sm:p-8" aria-labelledby="daily-q">
        <div key={shake} className={cx(shake > 0 && s.shake)}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="rounded-full bg-surface-2 px-3 py-1 font-medium text-ink-soft">{problem.topic}</span>
            <span className="num text-muted">Daily #{dayNumber(today)}</span>
          </div>
          <p
            id="daily-q"
            className="mt-5 text-xl leading-snug sm:text-2xl"
            dangerouslySetInnerHTML={{ __html: renderMath(problem.question) }}
          />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {problem.options.map((option, i) => {
              const wrong = record.picks.includes(i) && i !== problem.answer;
              const right = record.solved && i === problem.answer;
              return (
                <li key={i} className="relative">
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    disabled={record.solved || wrong || pending}
                    className={cx(
                      s.option,
                      'w-full rounded-2xl border-2 px-4 py-4 text-left text-lg',
                      right && 'scale-[1.03] border-gain bg-gain-soft text-gain-ink',
                      wrong && 'border-state-appeal/50 text-muted line-through opacity-60',
                      !right && !wrong && 'border-line text-ink',
                      !record.solved && !wrong && 'hover:-translate-y-0.5 hover:border-state-base hover:bg-surface-2',
                    )}
                    aria-label={`Answer ${i + 1}${wrong ? ', incorrect' : ''}${right ? ', correct' : ''}`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: renderMath(option) }} />
                  </button>
                  {right && burst > 0 && <Burst key={burst} />}
                </li>
              );
            })}
          </ul>

          <div aria-live="polite" className="mt-5 min-h-20">
            {error ? (
              <p className="text-state-appeal">{error}</p>
            ) : record.solved ? (
              <div className={s.fadeUp}>
                <p className="font-medium text-gain-ink">
                  {tries === 1 ? 'First try. Nice.' : `Got it in ${tries} tries.`} See you tomorrow.
                </p>
                <p
                  className="mt-2 rounded-xl bg-surface-2 px-4 py-3 text-ink-soft"
                  dangerouslySetInnerHTML={{ __html: renderMath(problem.solution) }}
                />
              </div>
            ) : tries > 0 ? (
              <p className="text-ink-soft">Not quite. Try another one.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

const COLORS = ['#ff6b4a', '#60a5fa', '#a78bfa', '#ffb020', '#3ccf7f', '#f472b6'];

function Burst() {
  return (
    <span className={s.burst} aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const dist = 70 + (i % 4) * 22;
        return (
          <i
            key={i}
            style={
              {
                '--x': `${Math.cos(angle) * dist}px`,
                '--y': `${Math.sin(angle) * dist}px`,
                '--r': `${(i % 2 ? 1 : -1) * (120 + i * 17)}deg`,
                '--c': COLORS[i % COLORS.length],
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
