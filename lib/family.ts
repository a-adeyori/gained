// Families: a parent and the students under them. Whoever adds the other first makes the link,
// straight away, from either side:
//   - a parent adds a child's email: an existing student joins now; a new email gets a child
//     account the student takes over when they sign up with that email;
//   - a student adds a parent's email: an existing parent is linked now; otherwise the parent is
//     linked the moment they sign up or sign in with it.
// A student belongs to one family; once linked, later attempts from anyone else are refused.
// Pure functions (no database), so the rules are tested.

type Role = 'parent' | 'student' | 'tutor' | 'admin';
type Account = { id: string; role: Role; parent_id: string | null; password_hash: string | null };

export type AddChildDecision =
  | { kind: 'create' }
  | { kind: 'link' }
  | { kind: 'already-linked' }
  | { kind: 'error'; message: string };

/** A parent adds a child by email. */
export function decideAddChild(existing: Account | null, parentId: string): AddChildDecision {
  if (!existing) return { kind: 'create' };
  if (existing.id === parentId) return { kind: 'error', message: 'That’s your own email. Choose “Me” to book for yourself.' };
  if (existing.role !== 'student') {
    return { kind: 'error', message: `That email belongs to a ${existing.role} account. Students need their own student account.` };
  }
  if (existing.parent_id === parentId) return { kind: 'already-linked' };
  if (existing.parent_id) return { kind: 'error', message: 'That student is already part of another family.' };
  return { kind: 'link' };
}

export type AddParentDecision =
  | { kind: 'link' }
  | { kind: 'invite' }
  | { kind: 'error'; message: string };

/** A student adds their parent by email. */
export function decideAddParent(
  student: { id: string; email: string; parent_id: string | null },
  parentEmail: string,
  existing: Account | null,
): AddParentDecision {
  if (student.parent_id) return { kind: 'error', message: 'You’re already part of a family.' };
  if (parentEmail === student.email.toLowerCase()) return { kind: 'error', message: 'That’s your own email. Add your parent’s.' };
  if (!existing) return { kind: 'invite' };
  if (existing.role !== 'parent') return { kind: 'error', message: `That email belongs to a ${existing.role} account, not a parent.` };
  return { kind: 'link' };
}

export type SignUpDecision = { kind: 'create' } | { kind: 'claim' } | { kind: 'error'; message: string };

/**
 * Signing up with an email that's taken. A student a parent already added (no password yet)
 * takes over that account, keeping the family link. Anything else is a real duplicate.
 */
export function decideSignUp(existing: Account | null, role: Role): SignUpDecision {
  if (!existing) return { kind: 'create' };
  if (existing.role === 'student' && !existing.password_hash) {
    return role === 'student'
      ? { kind: 'claim' }
      : { kind: 'error', message: 'A parent added this email as a student. Choose Student to finish setting it up.' };
  }
  return { kind: 'error', message: 'That email already has an account. Sign in instead.' };
}
