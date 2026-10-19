'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { openAppeal } from '../actions';

export function AppealForm({ sessionId, closesAt }: { sessionId: string; closesAt: string }) {
  const [state, action, pending] = useActionState(openAppeal.bind(null, sessionId), undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="What seems wrong?" hint="For example: a question tested something we didn’t cover, or a right answer was marked wrong.">
        <textarea name="reason" required minLength={10} rows={5} className={`${inputClass} py-3`} />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm text-state-appeal">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send appeal'}
      </Button>
      <p className="text-xs text-muted">
        Open until {new Date(closesAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
      </p>
    </form>
  );
}
