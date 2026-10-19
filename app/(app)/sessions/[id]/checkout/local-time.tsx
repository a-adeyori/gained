'use client';

// Shows a date in the viewer's own time zone. The server has no idea what that is, so it
// renders nothing and the browser fills it in after hydration (no mismatch).

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

export function LocalTime({ iso, endIso }: { iso: string; endIso?: string }) {
  const text = useSyncExternalStore(
    noop,
    () => {
      const start = new Date(iso);
      const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return endIso ? `${day}, ${time(start)}–${time(new Date(endIso))}` : `${day}, ${time(start)}`;
    },
    () => null,
  );
  return <time dateTime={iso}>{text ?? ' '}</time>;
}
