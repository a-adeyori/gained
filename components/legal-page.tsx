// Shared layout for the terms and privacy pages: readable prose, and a clear notice while the
// text is still a draft awaiting legal review.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './ui';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:py-16">
      <Link href="/" className="mb-10 inline-block">
        <Logo />
      </Link>
      <p
        role="note"
        className="mb-8 rounded-xl px-4 py-3 text-sm"
        style={{ background: 'color-mix(in srgb, #ffb020 16%, var(--card))', border: '1px solid color-mix(in srgb, #ffb020 50%, transparent)' }}
      >
        <strong>Draft.</strong> This page describes how Gained works today but hasn’t been reviewed by a lawyer yet. Items in
        [brackets] are still to be decided.
      </p>
      <h1 className="font-display text-5xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-10 space-y-8 leading-relaxed text-ink-soft [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
