// Closing call to action and the minimal footer.

import Link from 'next/link';
import { ButtonLink, Logo } from '@/components/ui';
import { PAYPAL_LIVE } from '@/lib/paypal';
import styles from './landing.module.css';

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className={`${styles.dark} ${styles.glow}`}>
      <div className="mx-auto w-full max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <h2
          id="cta-title"
          className="mx-auto max-w-4xl font-display text-6xl leading-[0.95] tracking-tight sm:text-9xl"
        >
          Pay for <em className="italic text-gain-ink">progress.</em>
        </h2>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <ButtonLink href="/signup" className="px-6">
            Book an in-person session
          </ButtonLink>
          <Link
            href="/signup?role=tutor"
            className="rounded-md text-[15px] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            I&rsquo;m a tutor
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className={`${styles.dark} border-t border-line`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo className="text-xl text-ink" />
        <p>
          {PAYPAL_LIVE
            ? 'Payments are held and paid out through PayPal.'
            : 'PayPal sandbox pilot, no real money changes hands during the hackathon.'}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms" className="rounded-md hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="rounded-md hover:text-ink">
            Privacy
          </Link>
          <Link href="/signin" className="rounded-md hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-md hover:text-ink">
            Sign up
          </Link>
        </nav>
      </div>
    </footer>
  );
}
