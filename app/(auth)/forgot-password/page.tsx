import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-10 self-start">
        <Logo />
      </Link>
      <h1 className="font-display text-4xl tracking-tight">Reset your password</h1>
      <p className="mt-2 text-ink-soft">Enter your email and we’ll send you a link to choose a new one.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-muted">
        Remembered it?{' '}
        <Link href="/signin" className="font-medium text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
