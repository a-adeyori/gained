'use client';

// The tutor's booking profile: hourly price, subjects, the meeting link sessions happen on, bio
// and the PayPal email for payouts.

import { useActionState } from 'react';
import { Button, Field, inputClass, cx } from '@/components/ui';
import { SUBJECTS, type Subject } from '@/lib/booking';
import { saveProfile } from './actions';

export function ProfileForm({
  priceCents,
  subjects,
  bio,
  meetingLink,
  paypalEmail,
}: {
  priceCents: number | null;
  subjects: Subject[];
  bio: string;
  meetingLink: string;
  paypalEmail: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);

  return (
    <form action={action} className="space-y-5">
      <Field label="Price for 60 minutes" hint="30 and 90 minute sessions are prorated. Families pay this only when the quiz shows learning; 80% is guaranteed.">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">$</span>
          <input
            name="price"
            inputMode="decimal"
            required
            defaultValue={priceCents ? (priceCents / 100).toFixed(2) : ''}
            placeholder="60.00"
            className={cx(inputClass, 'num pl-7')}
          />
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Subjects</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 has-checked:border-ink">
              <input type="checkbox" name="subjects" value={s} defaultChecked={subjects.includes(s)} />
              {s}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Pick every subject you teach. Families filter tutors by subject.</p>
      </fieldset>

      <Field
        label="Your meeting link"
        hint="Sessions are online. Paste your Zoom Personal Room or Google Meet link once; families get it in their booking email and on every session page."
      >
        <input
          name="meetingLink"
          inputMode="url"
          required
          maxLength={300}
          defaultValue={meetingLink}
          placeholder="https://zoom.us/j/1234567890 or https://meet.google.com/abc-defg-hij"
          autoComplete="url"
          className={inputClass}
        />
      </Field>

      <Field label="Bio" hint="A sentence or two families see when booking.">
        <textarea name="bio" rows={3} maxLength={600} defaultValue={bio} className={cx(inputClass, 'py-2.5')} />
      </Field>

      <Field label="PayPal email for payouts">
        <input name="paypalEmail" type="email" required defaultValue={paypalEmail} autoComplete="email" className={inputClass} />
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-state-appeal">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-ink-soft">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
