// The page an emailed set-password link opens: finishing a child account a parent created, or
// resetting a forgotten password. The link is checked first, so an old one says so up front.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import { accountForPasswordLink } from '@/lib/verification';
import { SetPasswordForm } from './set-password-form';

export const metadata: Metadata = { title: 'Choose a password' };

export default async function SetPasswordPage({ searchParams }: PageProps<'/set-password'>) {
  const { t } = await searchParams;
  const token = typeof t === 'string' ? t : undefined;
  const user = await accountForPasswordLink(token);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-10 self-start">
        <Logo />
      </Link>
      {user && token ? (
        <>
          <h1 className="font-display text-4xl tracking-tight">Choose a password</h1>
          <p className="mt-2 text-ink-soft">For {user.email}.</p>
          <SetPasswordForm token={token} />
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl tracking-tight">This link has expired</h1>
          <p className="mt-2 text-ink-soft">
            Links work for 2 hours, once. Sign up again with the same email and we’ll send a new one.
          </p>
          <Link href="/signup" className="mt-8 font-medium underline underline-offset-4">
            Get a new link
          </Link>
        </>
      )}
    </main>
  );
}
