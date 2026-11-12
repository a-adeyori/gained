'use server';

// The account's time zone, which emails use (lib/time-zone.ts). The browser reports its zone on
// each signed-in visit; a zone picked on the Account page sticks until set back to Automatic.
// Also deleting an account: your own, or a parent deleting a child's (lib/account-deletion.ts).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canDeleteChildAccount, canDeleteOwnAccount, MONEY_IN_FLIGHT, moneyInFlightReason, type DeletionCheck } from '@/lib/account-deletion';
import { currentUser, endSession } from '@/lib/auth';
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

export type DeleteState = { error?: string } | undefined;

/** Deletes the signed-in account, signs out and goes to the landing page. */
export async function deleteOwnAccount(): Promise<DeleteState> {
  const user = await currentUser();
  if (!user) redirect('/signin');
  const check = canDeleteOwnAccount(user);
  if (!check.ok) return { error: check.reason };
  const done = await deleteAccount(user.id, { self: true });
  if (!done.ok) return { error: done.reason };
  await endSession();
  redirect('/');
}

/** A parent deletes one of their children's accounts. */
export async function deleteChildAccount(childId: string): Promise<DeleteState> {
  const user = await currentUser();
  if (!user) redirect('/signin');
  const child = await db.user.findUnique({ where: { id: childId } });
  const check = canDeleteChildAccount(user, child);
  if (!check.ok) return { error: check.reason };
  const done = await deleteAccount(childId, { self: false });
  if (!done.ok) return { error: done.reason };
  revalidatePath('/', 'layout');
  return undefined;
}

/**
 * Deletes the account and everything tied to it, in one transaction. Returns the reason instead
 * when a session still has money held.
 */
async function deleteAccount(userId: string, { self }: { self: boolean }): Promise<DeletionCheck> {
  return db.$transaction(async (tx) => {
    // Child accounts a parent created that nobody ever signed into go with the parent.
    const placeholders = await tx.user.findMany({ where: { parent_id: userId, password_hash: null }, select: { id: true } });
    const ids = [userId, ...placeholders.map((u) => u.id)];
    const involved = { OR: [{ tutor_id: { in: ids } }, { student_id: { in: ids } }, { payer_id: { in: ids } }] };

    const busy = await tx.session.count({ where: { ...involved, escrow: { state: { in: [...MONEY_IN_FLIGHT] } } } });
    if (busy) return { ok: false, reason: moneyInFlightReason(busy, self) };

    const sessionIds = (await tx.session.findMany({ where: involved, select: { id: true } })).map((s) => s.id);
    const ofSessions = { session_id: { in: sessionIds } };
    await tx.answer.deleteMany({ where: { quiz: ofSessions } });
    await tx.quiz.deleteMany({ where: ofSessions });
    await tx.result.deleteMany({ where: ofSessions });
    await tx.appeal.deleteMany({ where: ofSessions });
    await tx.escrow.deleteMany({ where: ofSessions });
    await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
    await tx.availability.deleteMany({ where: { tutor_id: { in: ids } } });
    // Problem-of-the-day attempts cascade; children with their own login are unlinked.
    await tx.user.deleteMany({ where: { id: { in: ids } } });
    return { ok: true };
  });
}
