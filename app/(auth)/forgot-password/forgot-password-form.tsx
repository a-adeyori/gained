'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { requestPasswordReset, type FormState } from '../actions';

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm text-state-appeal">
          {state.error}
        </p>
      )}
      {state?.notice && (
        <p role="status" className="rounded-xl bg-gain-soft px-4 py-3 text-sm text-gain-ink">
          {state.notice}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
