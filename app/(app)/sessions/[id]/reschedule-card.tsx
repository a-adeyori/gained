'use client';

// Move a session to another of the tutor's open times: a button that opens the open times,
// grouped by day in the viewer's own time zone. The rules are in lib/reschedule.ts.

import { useActionState, useMemo, useState, useSyncExternalStore } from 'react';
import { Button, Card } from '@/components/ui';
import { rescheduleSession } from './actions';

const noop = () => () => {};

export function RescheduleCard({
  sessionId,
  options,
  missed,
  note,
}: {
  sessionId: string;
  /** Open start times (ISO), soonest first. */
  options: string[];
  /** The start has passed and nobody started it (a no-show). */
  missed: boolean;
  /** Extra terms to show before confirming, e.g. that a late move keeps the late-cancellation fee. */
  note: string | null;
}) {
  const [open, setOpen] = useState(missed);
  const [picked, setPicked] = useState<string | null>(null);
  const [state, action, pending] = useActionState(rescheduleSession.bind(null, sessionId), undefined);
  // Times are shown in the browser's zone, so they're only formatted once in the browser.
  const browser = useSyncExternalStore(noop, () => true, () => false);

  const days = useMemo(() => {
    if (!browser) return [];
    const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const groups: { label: string; times: { iso: string; label: string }[] }[] = [];
    for (const iso of options) {
      const d = new Date(iso);
      const label = day.format(d);
      if (groups.at(-1)?.label !== label) groups.push({ label, times: [] });
      groups.at(-1)!.times.push({ iso, label: time.format(d) });
    }
    return groups;
  }, [browser, options]);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted">
        <span>Need a different time? Same price, nothing new charged.</span>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Move to another time
        </Button>
      </div>
    );
  }

  const pickedLabel = picked
    ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(picked))
    : null;

  return (
    <Card>
      <form action={action} className="space-y-4">
        <div>
          <p className="font-medium">{missed ? 'Missed it? Pick a new time' : 'Pick a new time'}</p>
          <p className="mt-1 text-sm text-ink-soft">
            The same length and price, and the same PayPal hold, so nothing new is charged. Everyone is emailed the new time.
            {note && ` ${note}`}
          </p>
        </div>
        {!options.length ? (
          <p className="text-sm text-ink-soft">The tutor has no open times in the next two weeks. Email them to arrange one, or cancel.</p>
        ) : (
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {days.map((d) => (
              <fieldset key={d.label}>
                <legend className="mb-2 text-sm font-medium">{d.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {d.times.map((t) => (
                    <label
                      key={t.iso}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                        picked === t.iso ? 'border-ink bg-ink text-surface' : 'border-line-strong hover:bg-surface-2'
                      }`}
                    >
                      <input type="radio" name="startAt" value={t.iso} className="sr-only" checked={picked === t.iso} onChange={() => setPicked(t.iso)} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
        {state?.error && (
          <p role="alert" className="text-sm text-state-appeal">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !picked}>
            {pending ? 'Moving…' : pickedLabel ? `Move to ${pickedLabel}` : 'Pick a time'}
          </Button>
          {!missed && (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Keep the current time
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
