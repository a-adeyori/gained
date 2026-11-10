'use client';

// Shows a date in the viewer's own time zone. The server has no idea what that is (on Render it
// runs in UTC), so it renders nothing and the browser fills it in after hydration (no mismatch).
// Every date a person reads on a page goes through here, so pages agree with the calendar.

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

const FORMATS = {
  /** Monday, November 9 at 7:00 PM */
  long: { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  /** Mon, Nov 9, 7:00 PM */
  short: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  /** Nov 9, 2026 */
  date: { month: 'short', day: 'numeric', year: 'numeric' },
  /** 7:00 PM */
  time: { hour: 'numeric', minute: '2-digit' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type TimeFormat = keyof typeof FORMATS;

/** `endIso` adds an end time: "Monday, November 9, 7:00–8:00 PM" (used at checkout). */
export function LocalTime({ iso, endIso, format = 'short' }: { iso: string; endIso?: string; format?: TimeFormat }) {
  const text = useSyncExternalStore(
    noop,
    () => {
      const start = new Date(iso);
      if (endIso) {
        const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const time = (d: Date) => d.toLocaleTimeString('en-US', FORMATS.time);
        return `${day}, ${time(start)}–${time(new Date(endIso))}`;
      }
      return start.toLocaleString('en-US', FORMATS[format]);
    },
    () => null,
  );
  return <time dateTime={iso}>{text ?? ' '}</time>;
}
