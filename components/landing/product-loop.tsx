'use client';

// The hero's silent product loop, built from the real components: a quiz question, the escrow
// states advancing, then the money split. Pausable, paused off-screen, and still (on the
// result) for people who prefer reduced motion.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { MoneySplit } from '@/components/money-split';
import { cx, EscrowBadge, Money } from '@/components/ui';
import type { EscrowStateKey } from '@/lib/escrow-states';
import { DeviceFrame } from './device-frame';
import { EXAMPLE } from './example';
import styles from './landing.module.css';

const TICK_MS = 1000;
const LOOP_TICKS = 17;
const ESCROW_START = 5;
const RESULT_START = 10;
const FINAL_TICK = LOOP_TICKS - 1;

const REDUCED = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const frameFor = (tick: number) => (tick < ESCROW_START ? 'quiz' : tick < RESULT_START ? 'escrow' : 'result');
// Each screen says whose view it is, so the loop reads as one session seen by everyone in it.
const TITLES = {
  quiz: 'Student · Check-in quiz, question 3 of 5',
  escrow: 'Parent · Session payment',
  result: 'Tutor & parent · Session result',
};

const OPTIONS = ['3 m', '6 m', '9 m', '18 m'];
const CORRECT = 2;

const ESCROW_STEPS: { state: EscrowStateKey; when: string; detail: ReactNode }[] = [
  {
    state: 'held',
    when: 'At booking',
    detail: (
      <>
        <Money cents={EXAMPLE.priceCents} /> held, not charged
      </>
    ),
  },
  {
    state: 'base_paid',
    when: 'After the session',
    detail: (
      <>
        <Money cents={EXAMPLE.baseCents} /> base to the tutor
      </>
    ),
  },
  { state: 'awaiting_retention', when: '48 hours later', detail: 'Check-in quiz sent' },
  {
    state: 'settled',
    when: 'After the check-in',
    detail: (
      <>
        <Money cents={EXAMPLE.bonusCents} className="text-gain-ink" /> bonus · <Money cents={EXAMPLE.returnedCents} />{' '}
        back to you
      </>
    ),
  },
];

export function ProductLoop() {
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  // null until the viewer presses pause or play; then their choice wins over the default.
  const [choice, setChoice] = useState<boolean | null>(null);
  const [tickState, setTick] = useState(0);
  const [loop, setLoop] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const playing = choice ?? !reduced;
  const tick = reduced && choice === null ? FINAL_TICK : tickState;
  const frame = frameFor(tick);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !onScreen) return;
    const id = setInterval(() => {
      setTick((t) => {
        const next = (t + 1) % LOOP_TICKS;
        if (next === 0) setLoop((l) => l + 1);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, onScreen]);

  const answered = tick >= 2;
  const escrowShown = Math.max(0, Math.min(ESCROW_STEPS.length, tick - ESCROW_START + 1));

  return (
    <div ref={ref}>
      <DeviceFrame
        title={TITLES[frame]}
        action={
          <button
            type="button"
            onClick={() => setChoice(!playing)}
            className="rounded-full px-2 py-0.5 text-xs text-muted hover:bg-card hover:text-ink"
            aria-label={playing ? 'Pause the product animation' : 'Play the product animation'}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        }
      >
        <p className="sr-only">
          An example session: the student answers a short quiz question, the payment moves from Held to Base paid to
          Settled, and the $60.00 price splits into $48.00 base to the tutor, a $5.55 learning bonus and $6.45 back to
          whoever paid.
        </p>
        <div className={styles.stack} aria-hidden="true">
          {/* Quiz: one question per screen with a progress bar, like the student quiz. */}
          <div className={frame === 'quiz' ? styles.shown : styles.hidden}>
            <div className="mb-5 flex items-center gap-3 text-xs text-muted">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-3/5 rounded-full bg-gain" />
              </div>
              <span className="num">3 / 5</span>
            </div>
            <p className="text-sm font-medium text-muted">Physics · Kinematics</p>
            <p className="mt-1 text-lg leading-snug text-ink sm:text-xl">
              A cart starts from rest and accelerates at 2 m/s² for 3 seconds. How far does it travel?
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2.5">
              {OPTIONS.map((option, i) => (
                <li
                  key={option}
                  className={cx(
                    'num rounded-xl border px-4 py-3 text-[15px] transition-colors duration-300',
                    answered && i === CORRECT
                      ? 'border-gain bg-gain-soft text-gain-ink'
                      : 'border-line-strong text-ink',
                  )}
                >
                  {option}
                </li>
              ))}
            </ul>
            <p
              className={cx(
                'mt-4 text-sm text-gain-ink transition-opacity duration-300',
                answered ? 'opacity-100' : 'opacity-0',
              )}
            >
              Nice. ½ × 2 × 3² = 9 m.
            </p>
          </div>

          {/* Escrow: the same six states and colours as every other screen. */}
          <div className={frame === 'escrow' ? styles.shown : styles.hidden}>
            <ol className="space-y-2.5">
              {ESCROW_STEPS.map((step, i) => (
                <li
                  key={step.state}
                  className={cx(
                    'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line px-3.5 py-3 transition-opacity duration-500',
                    i < escrowShown ? 'opacity-100' : 'opacity-30',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <EscrowBadge state={step.state} />
                    <span className="text-xs text-muted">{step.when}</span>
                  </span>
                  <span className="text-sm text-ink">{step.detail}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Result: before and after, then the split. */}
          <div className={frame === 'result' ? styles.shown : styles.hidden}>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="flex gap-5">
                <Score label="Before" value={EXAMPLE.pre} />
                <Score label="After" value={EXAMPLE.post} />
                <Score label="48h later" value={EXAMPLE.retention} />
              </div>
              <EscrowBadge state="settled" />
            </div>
            <MoneySplit
              key={frame === 'result' ? `on-${loop}` : 'off'}
              animate={frame === 'result'}
              priceCents={EXAMPLE.priceCents}
              baseCents={EXAMPLE.baseCents}
              bonusCents={EXAMPLE.bonusCents}
              returnedCents={EXAMPLE.returnedCents}
            />
          </div>
        </div>
      </DeviceFrame>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-2xl font-semibold tracking-tight text-ink">{value}%</p>
    </div>
  );
}
