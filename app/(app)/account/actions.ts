'use server';

// The account's time zone, which emails use (lib/time-zone.ts). The browser reports its zone on
// each signed-in visit; a zone picked on the Account page sticks until set back to Automatic.

import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { isTimeZone } from '@/lib/time-zone';

/** Called by the browser (components/time-zone-sync.tsx). Never overrides a zone the person chose. */
export async function reportTimeZone(tz: string) {
  const user = await currentUser();
  if (!user || user.time_zone_manual || user.time_zone === tz || !isTimeZone(tz)) return;
  await db.user.update({ where: { id: user.id }, data: { time_zone: tz } });
}

export type TimeZoneState = { error?: string; ok?: boolean } | undefined;

/** The Account page's picker: "auto" follows the device again; anything else is fixed. */
export async function saveTimeZone(_prev: TimeZoneState, form: FormData): Promise<TimeZoneState> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in to change your time zone.' };
  const choice = String(form.get('timeZone') ?? '');
  if (choice === 'auto') {
    const device = String(form.get('device') ?? '');
    await db.user.update({
      where: { id: user.id },
      data: { time_zone: isTimeZone(device) ? device : user.time_zone, time_zone_manual: false },
    });
  } else if (isTimeZone(choice)) {
    await db.user.update({ where: { id: user.id }, data: { time_zone: choice, time_zone_manual: true } });
  } else {
    return { error: 'Pick a time zone from the list.' };
  }
  revalidatePath('/account');
  return { ok: true };
}
