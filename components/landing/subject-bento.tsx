// "Any subject": a bento of colour-blocked tiles, each with its own little living motif that
// wakes up on hover. Words kept to the subject names.

import type { CSSProperties, ReactNode } from 'react';
import { Spotlight } from './motion';
import s from './bento.module.css';

function Tile({ name, color, className, children }: { name: string; color: string; className?: string; children: ReactNode }) {
  return (
    <Spotlight className={`${s.tile} ${className ?? ''}`}>
      <div className={s.inner} style={{ '--tile': color } as CSSProperties}>
        <div className={s.art} aria-hidden="true">
          {children}
        </div>
        <h3 className={s.name}>{name}</h3>
      </div>
    </Spotlight>
  );
}

const Cycle = ({ words }: { words: string[] }) => (
  <span className={s.cycle} style={{ '--n': words.length } as CSSProperties}>
    <span>
      {[...words, words[0]].map((w, i) => (
        <span key={i}>{w}</span>
      ))}
    </span>
  </span>
);

export function SubjectBento() {
  return (
    <section id="subjects" aria-labelledby="subjects-title" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <h2 id="subjects-title" className="font-display text-6xl leading-[0.9] tracking-tight sm:text-8xl">
          Any subject.
          <br />
          <span className="italic text-muted">Online.</span>
        </h2>

        <div className={s.grid}>
          <Tile name="Math" color="#ff6b4a" className={s.big}>
            <svg viewBox="0 0 400 200" className={s.wave} preserveAspectRatio="none">
              <path d="M0 100 Q 50 10 100 100 T 200 100 T 300 100 T 400 100" />
              <path d="M0 100 Q 50 10 100 100 T 200 100 T 300 100 T 400 100" />
            </svg>
            <span className={s.equation}>
              <Cycle words={['y = sin x', 'x² − 5x + 6', '∫ 2x dx', 'a² + b² = c²']} />
            </span>
          </Tile>

          <Tile name="Chemistry" color="#b6f04a">
            <span className={s.formula}>H₂O</span>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={s.bubble} style={{ '--i': i } as CSSProperties} />
            ))}
          </Tile>

          <Tile name="Languages" color="#ffb020">
            <span className={s.word}>
              <Cycle words={['Hola', 'Bonjour', 'Ciao', 'Olá', 'Hallo']} />
            </span>
          </Tile>

          <Tile name="Biology" color="#f472b6">
            <span className={s.helix}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </span>
          </Tile>

          <Tile name="Code" color="#a78bfa">
            <span className={s.code}>
              <span className={s.typed}>learn(you)</span>
            </span>
          </Tile>

          <Tile name="History" color="#2dd4bf">
            <span className={s.year}>
              <Cycle words={['1492', '1776', '1865', '1969', '1989']} />
            </span>
          </Tile>

          <Tile name="Physics" color="#60a5fa">
            <span className={s.atom}>
              <i />
              <i />
              <i />
              <b />
            </span>
          </Tile>

          <Tile name="Writing" color="#fde047" className={s.wide}>
            <span className={s.quote}>
              “The <mark>first draft</mark> is just you telling yourself the story.”
            </span>
          </Tile>
        </div>
      </div>
    </section>
  );
}
