'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { decideAddParent } from '@/lib/family';
import { notifyFamily } from '@/lib/notify';

export type ParentState = { error?: string; linked?: string; invited?: string } | undefined;

const Email = z.email('Enter your parent’s email').transform((e) => e.toLowerCase());

/**
 * A student adds their parent. An existing parent account is linked now; otherwise the email is
 * remembered and the parent is linked when they sign up or sign in with it.
 */
export async function addParent(_prev: ParentState, form: FormData): Promise<ParentState> {
  const user = await currentUser();
  if (!user || user.role !== 'student') return { error: 'Sign in as a student to add a parent.' };
  const parsed = Email.safeParse(form.get('email'));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  const decision = decideAddParent(user, email, existing);
  if (decision.kind === 'error') return { error: decision.message };

  if (decision.kind === 'link' && existing) {
    // Only if nobody added this student in the meantime: whoever is first wins.
    const { count } = await db.user.updateMany({
      where: { id: user.id, parent_id: null },
      data: { parent_id: existing.id, invited_parent_email: null },
    });
    if (!count) return { error: 'You’re already part of a family.' };
    await notifyFamily('student-added-you', { toEmail: existing.email, toName: existing.name, byName: user.name });
    revalidatePath('/home');
    return { linked: existing.name };
  }

  await db.user.update({ where: { id: user.id }, data: { invited_parent_email: email } });
  await notifyFamily('invited', { toEmail: email, toName: email, byName: user.name });
  revalidatePath('/home');
  return { invited: email };
}

/** Takes back an invite to a parent who hasn't signed up yet. */
export async function cancelParentInvite() {
  const user = await currentUser();
  if (!user || user.role !== 'student') return;
  await db.user.update({ where: { id: user.id }, data: { invited_parent_email: null } });
  revalidatePath('/home');
}
