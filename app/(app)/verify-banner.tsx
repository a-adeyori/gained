'use client';

// Shown on every signed-in page until the email is confirmed. Family links wait for it.

import { useActionState } from 'react';
import { resendVerification, type FormState } from '@/app/(auth)/actions';

export function VerifyBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resendVerification, undefined);
  return (
    <div className="border-b border-line" style={{ background: 'color-mix(in srgb, #ffb020 14%, var(--surface))' }}>
      <form action={action} className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
        <span className="font-medium">Confirm your email.</span>
        <span className="text-ink-soft">
          {state?.notice ?? state?.error ?? `We sent a link to ${email}. Family links work once you click it.`}
        </span>
        <button disabled={pending} className="ml-auto font-medium underline underline-offset-4 disabled:opacity-50">
          {pending ? 'Sending…' : 'Resend link'}
        </button>
      </form>
    </div>
  );
}
