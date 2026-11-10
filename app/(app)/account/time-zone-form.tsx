'use client';

// Pick the time zone emails use: Automatic (follow this device), a US zone by its familiar
// name, or any other zone.

import { useActionState, useSyncExternalStore } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { timeZoneLabel, US_TIME_ZONES } from '@/lib/time-zone';
import { saveTimeZone } from './actions';

const noop = () => () => {};

export function TimeZoneForm({ saved, manual, zones }: { saved: string | null; manual: boolean; zones: string[] }) {
  const [state, action, pending] = useActionState(saveTimeZone, undefined);
  // The device's zone is only known in the browser; null while rendering on the server.
  const device = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
  const current = manual && saved ? saved : 'auto';
  // A zone saved before the list was shortened still shows as an option.
  const listed = current === 'auto' || US_TIME_ZONES.some((z) => z.tz === current) || zones.includes(current);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="device" value={device ?? ''} />
      <Field
        label="Your time zone"
        hint="Emails (booking confirmations, reminders and quiz links) show times in this zone. Pages always use your device’s current zone."
      >
        {/* Keyed by the saved choice: React resets a form after a successful action, and this
            makes the picker come back showing what was saved rather than its first value. */}
        <select key={current} name="timeZone" defaultValue={current} className={inputClass}>
          <option value="auto">Automatic{device ? ` (this device: ${timeZoneLabel(device)})` : ''}</option>
          <optgroup label="United States">
            {US_TIME_ZONES.map(({ tz }) => (
              <option key={tz} value={tz}>
                {timeZoneLabel(tz)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other time zones">
            {!listed && <option value={current}>{timeZoneLabel(current)}</option>}
            {zones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll('_', ' ')}
              </option>
            ))}
          </optgroup>
        </select>
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
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
