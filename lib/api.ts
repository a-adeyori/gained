// Shared helpers for route handlers: JSON errors and loading a session the caller may act on.
// Server-only.

import { currentUser, type CurrentUser } from './auth';
import { db } from './db';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Wraps a handler so a thrown HttpError becomes a JSON error response. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

export async function requireApiUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Sign in first.');
  return user;
}

/** The session, if the signed-in user is its tutor. */
export async function sessionForTutor(sessionId: string) {
  const user = await requireApiUser();
  const session = await db.session.findUnique({ where: { id: sessionId }, include: { escrow: true } });
  if (!session) throw new HttpError(404, 'Session not found.');
  if (session.tutor_id !== user.id) throw new HttpError(403, 'Only this session’s tutor can do that.');
  if (!session.escrow) throw new HttpError(409, 'This session hasn’t been paid for yet.');
  return session;
}
