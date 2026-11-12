'use client';

// Cancel a booking before it starts: a quiet button that opens a confirmation, so nobody cancels
// by accident. The rules are in lib/cancellation.ts; this only says what will happen.

import { useActionState, useState } from 'react';
import { LocalTime } from '@/components/local-time';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { MAX_CANCEL_REASON } from '@/lib/cancellation';
import { cancelSession } from './actions';

export function CancelCard({
  sessionId,
  as,
  otherName,
  price,
  freeUntil,
}: {
  sessionId: string;
  as: 'family' | 'tutor' | 'admin';
  /** Who is told: the tutor (for the family), or the student (for the tutor). */
  otherName: string;
  /** The held amount, formatted. */
  price: string;
  /** For the family: when free cancellation ends (ISO). */
  freeUntil: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(cancelSession.bind(null, sessionId), undefined);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted">
        <span>
          {as === 'family' && freeUntil ? (
            <>
              Free to cancel until <LocalTime iso={freeUntil} format="long" />.
            </>
          ) : (
            'Can’t make it?'
          )}
        </span>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Cancel session
        </Button>
      </div>
    );
  }

  const outcome =
    as === 'family'
      ? `The ${price} hold is released, so nothing is charged. ${otherName} is told by email and the time opens up for other bookings.`
      : as === 'tutor'
        ? `The family’s ${price} hold is released, so they pay nothing, and ${otherName} and their family are told by email. You aren’t paid for this session.`
        : `The ${price} hold is released and the family and tutor are told by email.`;

  return (
    <Card>
      <form action={action} className="space-y-4">
        <div>
          <p className="font-medium">Cancel this session?</p>
          <p className="mt-1 text-sm text-ink-soft">{outcome} This can’t be undone, but you can book again.</p>
        </div>
        <Field label="Reason (optional)" hint="Included in the email.">
          <textarea name="reason" rows={2} maxLength={MAX_CANCEL_REASON} className={`${inputClass} py-3`} />
        </Field>
        {state?.error && (
          <p role="alert" className="text-sm text-state-appeal">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? 'Cancelling…' : 'Yes, cancel it'}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
            Keep the session
          </Button>
        </div>
      </form>
    </Card>
  );
}
