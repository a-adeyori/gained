// Deleting an account wipes the person from the database: their account and every session they
// were part of (with its quizzes, answers, results, appeals and escrow record), their
// availability and problem-of-the-day streak. They can sign up again with the same email.
//
// Who may delete what:
//  - Parents and tutors delete their own account. So do students nobody manages (adults who
//    signed up on their own).
//  - A student in a family can't: their parent deletes the child's account for them.
//  - A parent's children keep their own accounts when the parent leaves; they're unlinked
//    (users.parent_id is ON DELETE SET NULL). Child accounts the parent created that were never
//    signed into (no password) go with the parent, since nobody else can reach them.
//  - Nobody deletes while a session they're part of still has money held at PayPal (a hold,
//    or a payout still waiting on quizzes or an appeal): deleting it would strand the payment.
//    Cancelling an upcoming session releases its hold; finished ones settle on their own.
//
// Pure, so it's tested and safe for the browser; the database work is deleteAccount in
// app/(app)/account/actions.ts.

type Role = 'parent' | 'student' | 'tutor' | 'admin';
type Account = { id: string; role: Role; parent_id: string | null };

export type DeletionCheck = { ok: true } | { ok: false; reason: string };

/** Escrow states where PayPal still holds money that hasn't reached its final place. */
export const MONEY_IN_FLIGHT = ['held', 'base_paid', 'awaiting_retention', 'in_appeal'] as const;

/** Whether someone can delete their own account from the Account page. */
export function canDeleteOwnAccount(user: Account): DeletionCheck {
  if (user.role === 'admin') return { ok: false, reason: 'Admin accounts can’t be deleted from here.' };
  if (user.role === 'student' && user.parent_id) {
    return { ok: false, reason: 'Your parent manages your account. Ask them to delete it from their Account page.' };
  }
  return { ok: true };
}

/** Whether a parent can delete this child's account. */
export function canDeleteChildAccount(parent: Account, child: Account | null): DeletionCheck {
  if (parent.role !== 'parent') return { ok: false, reason: 'Only a parent can delete a child’s account.' };
  if (!child || child.role !== 'student' || child.parent_id !== parent.id) {
    return { ok: false, reason: 'That account isn’t part of your family.' };
  }
  return { ok: true };
}

/** Why the deletion has to wait, given how many of their sessions still have money held. */
export function moneyInFlightReason(sessions: number, self: boolean): string {
  const whose = self ? 'You have' : 'They have';
  const n = sessions === 1 ? '1 session' : `${sessions} sessions`;
  return (
    `${whose} ${n} with a payment still in progress, so the account can’t be deleted yet. ` +
    'Cancel upcoming sessions from their session page to release the hold; finished ones settle a few days after the check-in quiz.'
  );
}
