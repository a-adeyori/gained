// How it works in three words. Panels widen on hover (desktop); one short line each.

import type { CSSProperties } from 'react';
import s from './steps.module.css';

const STEPS = [
  { n: '01', word: 'Book.', line: 'Your payment is held, not charged.', color: '#60a5fa', glyph: '◷' },
  { n: '02', word: 'Learn.', line: 'Live session. The tutor gets 80% right after.', color: '#a78bfa', glyph: '✦' },
  { n: '03', word: 'Prove it.', line: 'A 5-minute quiz earns the rest. Unearned money comes back to you.', color: '#3ccf7f', glyph: '✓' },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
        <h2 id="how-title" className="sr-only">
          How it works
        </h2>
        <ol className={s.row}>
          {STEPS.map((step) => (
            <li key={step.n} className={s.panel} style={{ '--c': step.color } as CSSProperties} tabIndex={0}>
              <span className={s.glyph} aria-hidden="true">
                {step.glyph}
              </span>
              <span className={s.n}>{step.n}</span>
              <div className={s.body}>
                <p className={s.word}>{step.word}</p>
                <p className={s.line}>{step.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
