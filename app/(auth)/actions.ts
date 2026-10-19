'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { endSession, startSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { decideSignUp } from '@/lib/family';
import { checkPassword, hashPassword } from '@/lib/signing';

export type FormState = { error?: string } | undefined;

const SignUp = z.object({
  role: z.enum(['student', 'parent', 'tutor']),
  name: z.string().trim().min(1, 'Enter your name'),
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { role, name, email, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  const decision = decideSignUp(existing, role);
  if (decision.kind === 'error') return { error: decision.message };

  const password_hash = await hashPassword(password);
  const user =
    decision.kind === 'claim' && existing
      ? // A parent already added this student: they take over the account and stay in the family.
        await db.user.update({ where: { id: existing.id }, data: { name, password_hash } })
      : await db.user.create({
          data: {
            role,
            name,
            email,
            password_hash,
            // Tutors are paid at their account email unless they change it in their profile.
            paypal_email: role === 'tutor' ? email : null,
          },
        });
  if (user.role === 'parent') await linkInvitedChildren(user.id, user.email);
  await startSession(user.id);
  redirect(role === 'tutor' ? '/tutor/availability' : '/home');
}

/** Students who added this parent's email before the parent had an account join their family. */
async function linkInvitedChildren(parentId: string, email: string) {
  await db.user.updateMany({
    where: { role: 'student', parent_id: null, invited_parent_email: email.toLowerCase() },
    data: { parent_id: parentId, invited_parent_email: null },
  });
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.password_hash))) return { error: 'That email and password don’t match.' };
  if (user.role === 'parent') await linkInvitedChildren(user.id, user.email);
  await startSession(user.id);
  redirect('/home');
}

export async function signOut() {
  await endSession();
  redirect('/');
}
