// Dark hero with depth: an aurora in the three money colours, equations drifting with the
// pointer, a headline that rises in word by word, and the real product looping in a tilted frame.

import Link from 'next/link';
import { Fragment, type CSSProperties } from 'react';
import { ButtonLink, Logo } from '@/components/ui';
import { HeroStage } from './hero-stage';
import { ProductLoop } from './product-loop';
import { TopicMarquee } from './topic-marquee';
import styles from './landing.module.css';

export function SiteHeader() {
  return (
    <header
      className={`${styles.dark} sticky top-0 z-40 border-b border-line/60 backdrop-blur-xl`}
      style={{ background: 'color-mix(in srgb, var(--surface) 72%, transparent)' }}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Gained home" className="rounded-md">
          <Logo className="text-[26px]" />
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
          <a href="#subjects" className="hidden rounded-full px-3 py-1.5 text-ink-soft hover:text-ink md:inline-block">
            Subjects
          </a>
          <a href="#how" className="hidden rounded-full px-3 py-1.5 text-ink-soft hover:text-ink md:inline-block">
            How it works
          </a>
          <Link href="/signin" className="rounded-full px-3 py-1.5 text-ink-soft hover:text-ink">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="ml-1 hidden rounded-full bg-ink px-4 py-1.5 font-medium text-surface hover:opacity-90 sm:inline-block"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

// Position (%), depth (parallax strength) and size of each floating glyph: notation from every
// subject a tutor might teach, not just math.
// Each glyph wears its subject's colour from the bento below.
const GLYPHS: { text: string; x: number; y: number; d: number; size: string; delay: number; color: string }[] = [
  { text: 'F = ma', x: 5, y: 16, d: 0.9, size: 'text-3xl', delay: 0, color: '#60a5fa' },
  { text: 'H₂O', x: 44, y: 7, d: 0.5, size: 'text-3xl', delay: -3, color: '#b6f04a' },
  { text: 'dy/dx', x: 88, y: 12, d: 1.2, size: 'text-4xl', delay: -6, color: '#ff6b4a' },
  { text: '¿Qué tal?', x: 3, y: 70, d: 0.6, size: 'text-2xl', delay: -2, color: '#ffb020' },
  { text: 'π', x: 52, y: 86, d: 1.4, size: 'text-6xl', delay: -5, color: '#ff6b4a' },
  { text: 'A–T · C–G', x: 90, y: 58, d: 0.8, size: 'text-2xl', delay: -1, color: '#f472b6' },
  { text: '1776', x: 72, y: 90, d: 0.4, size: 'text-3xl', delay: -4, color: '#2dd4bf' },
  { text: 'def learn():', x: 18, y: 93, d: 0.7, size: 'text-lg', delay: -7, color: '#a78bfa' },
  { text: 'E = mc²', x: 34, y: 38, d: 1.6, size: 'text-2xl', delay: -8, color: '#60a5fa' },
  { text: 'Bonjour', x: 64, y: 30, d: 1.1, size: 'text-xl', delay: -9, color: '#ffb020' },
  { text: '“To be, or not to be”', x: 76, y: 76, d: 0.5, size: 'text-lg', delay: -2.5, color: '#fde047' },
  { text: 'C₆H₁₂O₆', x: 24, y: 6, d: 1.0, size: 'text-xl', delay: -6.5, color: '#b6f04a' },
];

// Everyone the product serves, each with a sign-up that starts on their role.
const ROLES = [
  { role: 'student', label: 'Student' },
  { role: 'parent', label: 'Parent' },
  { role: 'tutor', label: 'Tutor' },
] as const;

function Words({ text, start = 0, className }: { text: string; start?: number; className?: string }) {
  // The space sits outside each inline-block word, so the headline can still wrap.
  return text.split(' ').map((word, i) => (
    <Fragment key={i}>
      <span className={`${styles.word} ${className ?? ''}`} style={{ animationDelay: `${start + i * 90}ms` }}>
        {word}
      </span>{' '}
    </Fragment>
  ));
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={`${styles.dark} relative overflow-hidden`}>
      <HeroStage className="relative">
        <div className={styles.aurora} aria-hidden="true">
          <div className={`${styles.blob} ${styles.blobA}`} />
          <div className={`${styles.blob} ${styles.blobB}`} />
          <div className={`${styles.blob} ${styles.blobC}`} />
          <div className={`${styles.blob} ${styles.blobD}`} />
          <div className={`${styles.blob} ${styles.blobE}`} />
        </div>
        <div className={styles.grid} aria-hidden="true" />
        <div className="absolute inset-0 hidden sm:block" aria-hidden="true">
          {GLYPHS.map((g) => (
            <span
              key={g.text}
              className={`${styles.glyph} ${g.size}`}
              style={{ left: `${g.x}%`, top: `${g.y}%`, '--d': g.d } as CSSProperties}
            >
              <span style={{ animationDelay: `${g.delay}s`, color: g.color }}>{g.text}</span>
            </span>
          ))}
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div>
            <p
              className={`${styles.fadeUp} mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-ink-soft`}
              style={{ animationDelay: '0ms' }}
            >
              <span className="size-1.5 rounded-full bg-gain" aria-hidden="true" />
              Online tutoring, any subject
            </p>
            <h1
              id="hero-title"
              className="font-display text-[3.4rem] leading-[0.95] tracking-tight sm:text-8xl lg:text-[6.2rem]"
            >
              <Words text="Learning that" />
              <span className="relative inline-block">
                <em className={`${styles.word} ${styles.rainbow} italic`} style={{ animationDelay: '420ms' }}>
                  pays off.
                </em>
                <svg
                  className={`${styles.underline} absolute -bottom-2 left-0 h-4 w-full`}
                  viewBox="0 0 300 20"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="hero-underline" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0" stopColor="#ff6b4a" />
                      <stop offset="0.35" stopColor="#ffb020" />
                      <stop offset="0.7" stopColor="#f472b6" />
                      <stop offset="1" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M4 14 C 60 4, 120 4, 170 10 S 260 18, 296 6"
                    fill="none"
                    stroke="url(#hero-underline)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p
              className={`${styles.fadeUp} mt-7 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl`}
              style={{ animationDelay: '700ms' }}
            >
              Tutor and student meet face to face. Payment waits until a short quiz shows real progress, tutors earn a
              bonus when students improve, and anything unearned goes back to whoever paid.
            </p>
            <div
              className={`${styles.fadeUp} mt-9 flex flex-wrap items-center gap-x-6 gap-y-4`}
              style={{ animationDelay: '850ms' }}
            >
              <ButtonLink href="/signup" className={`${styles.glowButton} px-7`}>
                Get started
              </ButtonLink>
              <a
                href="#how"
                className="rounded-md text-[15px] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                How it works ↓
              </a>
            </div>
            <nav
              aria-label="Join as"
              className={`${styles.fadeUp} mt-7 flex flex-wrap items-center gap-2 text-sm`}
              style={{ animationDelay: '950ms' }}
            >
              <span className="mr-1 text-muted">Join as a</span>
              {ROLES.map((r) => (
                <Link
                  key={r.role}
                  href={`/signup?role=${r.role}`}
                  className="rounded-full border border-line-strong px-3.5 py-1.5 text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  {r.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className={`${styles.fadeUp} relative`} style={{ animationDelay: '500ms' }}>
            <div className={styles.halo} aria-hidden="true" />
            <div className={`${styles.tilt} relative`}>
              <div>
                <ProductLoop />
              </div>
            </div>
            <p className="relative mt-4 text-center text-xs text-muted">
              The real product, with an example $60 session.
            </p>
          </div>
        </div>

        <div className="relative pb-12">
          <TopicMarquee />
        </div>
      </HeroStage>
    </section>
  );
}
