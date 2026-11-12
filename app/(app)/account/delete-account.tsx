'use client';

// A "Delete account" button that opens a confirmation pop-up first, so nobody deletes by
// accident. Used for your own account, and by a parent for a child's (lib/account-deletion.ts).

import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui';
import { deleteChildAccount, deleteOwnAccount, type DeleteState } from './actions';

export function DeleteAccount({
  child,
  hasChildren = false,
  compact = false,
}: {
  /** Set when a parent is deleting this child's account; otherwise it's the signed-in account. */
  child?: { id: string; name: string };
  /** A parent deleting their own account: their children keep theirs. */
  hasChildren?: boolean;
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    child ? deleteChildAccount.bind(null, child.id) : deleteOwnAccount,
    undefined,
  );
  const first = child?.name.split(' ')[0];

  return (
    <>
      <Button type="button" variant="danger" className={compact ? 'min-h-9 px-4 text-sm' : undefined} onClick={() => dialog.current?.showModal()}>
        {child ? 'Delete account' : 'Delete my account'}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={child ? `delete-${child.id}` : 'delete-self'}
        // Clicking the dimmed backdrop closes it, unless a deletion is under way.
        onClick={(e) => e.target === e.currentTarget && !pending && dialog.current?.close()}
        onCancel={(e) => pending && e.preventDefault()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <form action={action} className="space-y-4 p-6">
          <h2 id={child ? `delete-${child.id}` : 'delete-self'} className="font-display text-2xl leading-tight tracking-tight">
            {child ? `Delete ${child.name}’s account?` : 'Delete your account?'}
          </h2>
          <div className="space-y-2 text-sm text-ink-soft">
            <p>
              {child
                ? `This permanently removes ${first}’s account, along with their sessions, quizzes, results and problem-of-the-day streak.`
                : 'This permanently removes your account, along with every session, quiz and result you’re part of.'}{' '}
              It can’t be undone.
            </p>
            {!child && hasChildren && (
              <p>
                Children who’ve signed in keep their own accounts, just no longer linked to you. Child accounts you added
                that were never signed into are removed with yours.
              </p>
            )}
            <p>
              {child ? `${first} can` : 'You can'} always sign up again with the same email, starting fresh.
            </p>
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-state-appeal">
              {state.error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>
              Keep {child ? 'it' : 'my account'}
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? 'Deleting…' : child ? `Yes, delete ${first}’s account` : 'Yes, delete my account'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
