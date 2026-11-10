'use client';

// Tells the server this device's time zone on each signed-in visit, so emails can show times
// in it. Renders nothing. Skipped when the person picked a zone on the Account page.

import { useEffect } from 'react';
import { reportTimeZone } from '@/app/(app)/account/actions';

export function TimeZoneSync({ saved, manual }: { saved: string | null; manual: boolean }) {
  useEffect(() => {
    if (manual) return;
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device && device !== saved) void reportTimeZone(device);
  }, [saved, manual]);
  return null;
}
