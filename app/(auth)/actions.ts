'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser, endSession, startSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { decideSignUp } from '@/lib/family';
import { linkInvitedChildren } from '@/lib/family-links';
import { checkPassword, hashPassword } from '@/lib/signing';
import { sendSetPassword, sendVerification, setPasswordFromLink } from '@/lib/verification';

export type FormState = { error?: string; notice?: string } | undefined;

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

  if (decision.kind === 'claim' && existing) {
    // A parent already added this student. Anyone could type this email, so the password is
    // chosen from a link sent to it: only whoever holds the inbox can finish. Nothing changes yet.
    await sendSetPassword(existing, { claim: true });
    return { notice: `A parent already added this email. We sent a link to ${email}: open it to choose your password.` };
  }

  const password_hash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      role,
      name,
      email,
      password_hash,
      // Tutors are paid at their account email unless they change it in their profile.
      paypal_email: role === 'tutor' ? email : null,
    },
  });
  await sendVerification(user);
  await startSession(user.id);
  redirect(role === 'tutor' ? '/tutor/availability' : '/home');
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.password_hash))) return { error: 'That email and password don’t match.' };
  // Students who added this parent's email first join their family (verified parents only).
  await linkInvitedChildren(user);
  await startSession(user.id);
  redirect('/home');
}

/** Sends the verification link again, from the banner shown until the email is confirmed. */
export async function resendVerification(): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in first.' };
  if (user.email_verified_at) return { notice: 'Your email is already confirmed.' };
  await sendVerification(user);
  return { notice: `Sent. Check ${user.email}.` };
}

/**
 * Emails a link to choose a new password. The reply is the same whether or not the email has
 * an account, so the form can't be used to find out who's signed up.
 */
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z.email('Enter a valid email').safeParse(String(form.get('email') ?? '').trim().toLowerCase());
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;
  const user = await db.user.findUnique({ where: { email } });
  // A child account a parent created has no password yet: the same link sets one up.
  if (user) await sendSetPassword(user, { claim: !user.password_hash });
  return { notice: `If ${email} has an account, a link to choose a new password is on its way. It works for 2 hours.` };
}

const NewPassword = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Use at least 8 characters'),
});

/** Chooses a password from an emailed link (taking over a child account, or a reset). */
export async function setPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = NewPassword.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await setPasswordFromLink(parsed.data.token, parsed.data.password);
  if (!user) return { error: 'This link has expired or was already used. Ask for a new one from the sign-in page.' };
  await startSession(user.id);
  redirect('/home');
}

export async function signOut() {
  await endSession();
  redirect('/');
}
