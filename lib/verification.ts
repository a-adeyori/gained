// Proving someone owns an email address, with signed links (lib/signing.ts):
//   - confirm: emailed at sign-up. Until it's clicked they can use the app but can't make
//     family links (lib/family.ts).
//   - set password: emailed to take over a child account a parent created, and for "forgot
//     password". Whoever holds the inbox chooses the password on our page, so nothing typed by
//     someone else ever takes effect. Single-use: it stops working once the password changes.
// Choosing a password from an emailed link also confirms the address. Server-only.

import { createHash } from 'node:crypto';
import { db } from './db';
import { setPasswordMessage, verifyEmailMessage } from './emails';
import { linkInvitedChildren } from './family-links';
import { appUrl, sendEmail } from './mail';
import { hashPassword, readLink, signLink } from './signing';

const CONFIRM_TTL_MS = 3 * 24 * 3600_000;
const SET_PASSWORD_TTL_MS = 2 * 3600_000;

type ConfirmLink = { uid: string; email: string };
// `pw` fingerprints the password at the time the link was sent ('' for none).
type PasswordLink = { uid: string; email: string; pw: string };

const fingerprint = (hash: string | null) => (hash ? createHash('sha256').update(hash).digest('base64url').slice(0, 16) : '');

type Person = { id: string; name: string; email: string };

export async function sendVerification(user: Person) {
  const token = signLink('verify', { uid: user.id, email: user.email } satisfies ConfirmLink, CONFIRM_TTL_MS);
  return sendEmail({ to: user.email, ...verifyEmailMessage({ name: user.name, link: appUrl(`/verify?t=${token}`) }) });
}

/** Confirms the address from an emailed link. Returns the user, or null if the link is bad. */
export async function confirmEmail(token: string | undefined) {
  const link = readLink<ConfirmLink>('verify', token);
  if (!link) return null;
  const user = await db.user.findUnique({ where: { id: link.uid } });
  if (!user || user.email !== link.email) return null;
  const verified = user.email_verified_at
    ? user
    : await db.user.update({ where: { id: user.id }, data: { email_verified_at: new Date() } });
  await linkInvitedChildren(verified);
  return verified;
}

/** `claim`: a child account a parent created, being set up by the student for the first time. */
export async function sendSetPassword(user: Person & { password_hash: string | null }, opts: { claim: boolean }) {
  const data: PasswordLink = { uid: user.id, email: user.email, pw: fingerprint(user.password_hash) };
  const token = signLink('reset', data, SET_PASSWORD_TTL_MS);
  return sendEmail({ to: user.email, ...setPasswordMessage({ name: user.name, link: appUrl(`/set-password?t=${token}`), claim: opts.claim }) });
}

/** The account a set-password link is for, if it's still valid (unexpired, unused). */
export async function accountForPasswordLink(token: string | undefined) {
  const link = readLink<PasswordLink>('reset', token);
  if (!link) return null;
  const user = await db.user.findUnique({ where: { id: link.uid } });
  if (!user || user.email !== link.email || fingerprint(user.password_hash) !== link.pw) return null;
  return user;
}

/** Sets the password from a valid link, confirms the address, and links invited children. */
export async function setPasswordFromLink(token: string | undefined, password: string) {
  const user = await accountForPasswordLink(token);
  if (!user) return null;
  const updated = await db.user.update({
    where: { id: user.id },
    data: { password_hash: await hashPassword(password), email_verified_at: user.email_verified_at ?? new Date() },
  });
  await linkInvitedChildren(updated);
  return updated;
}
