// Shared building blocks. Server-safe (no hooks), so any page can use them.

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { ESCROW_STATES, formatUsd, type EscrowStateKey } from '@/lib/escrow-states';
import { meetingService } from '@/lib/meeting';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const BUTTON = {
  primary: 'bg-ink text-surface hover:opacity-90',
  gain: 'bg-gain text-white hover:opacity-90',
  secondary: 'border border-line-strong bg-card text-ink hover:bg-surface-2',
  ghost: 'text-ink-soft hover:bg-surface-2',
  danger: 'border border-state-appeal text-state-appeal hover:bg-surface-2',
};

type ButtonVariant = keyof typeof BUTTON;
const buttonClass = (variant: ButtonVariant, className?: string) =>
  cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    BUTTON[variant],
    className,
  );

export function Button({ variant = 'primary', className, ...props }: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = 'primary', className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/** Opens the tutor's Zoom or Google Meet link in a new tab, where sessions happen. */
export function JoinMeeting({ link, variant = 'primary', className }: { link: string | null; variant?: ButtonVariant; className?: string }) {
  if (!link) return <p className={cx('text-sm text-muted', className)}>The tutor hasn’t added their meeting link yet.</p>;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, className)}>
      Join on {meetingService(link) ?? 'video'} <span aria-hidden>↗</span>
    </a>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx('rounded-2xl border border-line bg-card p-5 sm:p-6', className)} {...props} />;
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cx('num', className)}>{formatUsd(cents)}</span>;
}

export function EscrowBadge({ state }: { state: EscrowStateKey }) {
  const s = ESCROW_STATES[state];
  return (
    <span
      title={s.explain}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={
        s.outline
          ? { border: `1px solid ${s.color}`, color: s.color }
          : { background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }
      }
    >
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/** Shown to a parent wherever money is held but hasn't moved. */
export function HeldNotCharged({ cents }: { cents: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
      <span className="size-2 rounded-full bg-state-held" />
      <span>
        <Money cents={cents} className="font-semibold" /> <strong>held, not charged.</strong>{' '}
        <span className="text-muted">It only moves once the session happens and the quiz shows progress.</span>
      </span>
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 sm:mb-8">
      {eyebrow && <p className="mb-1 text-sm font-medium text-muted">{eyebrow}</p>}
      <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{title}</h1>
      {children && <div className="mt-2 text-ink-soft">{children}</div>}
    </header>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-xl border border-line-strong bg-card px-3.5 text-[16px] text-ink placeholder:text-muted focus:border-focus focus:outline-none';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('font-display text-2xl tracking-tight', className)}>
      Gained<span className="text-gain">.</span>
    </span>
  );
}

export { cx };
