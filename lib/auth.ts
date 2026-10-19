// Sign-in: an HMAC-signed cookie holding the user ID. Server-only.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import type { Role } from './generated/prisma/enums';
import { sign, verify } from './signing';

const COOKIE = 'gained_session';
const MAX_AGE_SECONDS = 30 * 24 * 3600;

type CookieData = { uid: string; exp: number };

export async function startSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, sign({ uid: userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 } satisfies CookieData), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const data = verify<CookieData>((await cookies()).get(COOKIE)?.value);
  if (!data || data.exp < Date.now()) return null;
  return db.user.findUnique({ where: { id: data.uid } });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** For pages: send signed-out visitors to sign in, and the wrong role home. */
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect('/signin');
  if (roles.length && !roles.includes(user.role)) redirect('/home');
  return user;
}

/** Who may see a session: its tutor, payer and student, plus admins. */
export function canViewSession(
  user: CurrentUser,
  session: { tutor_id: string; payer_id: string; student_id: string },
): boolean {
  return (
    user.role === 'admin' || [session.tutor_id, session.payer_id, session.student_id].includes(user.id)
  );
}
