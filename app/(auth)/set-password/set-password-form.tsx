'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { setPassword, type FormState } from '../actions';

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPassword, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 8 characters">
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm text-state-appeal">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'One moment…' : 'Save and sign in'}
      </Button>
    </form>
  );
}
