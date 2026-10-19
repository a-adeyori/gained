'use client';

// The student's family: who they're under, the parent email they're waiting on, or a form to
// add their parent. Whoever adds the other first makes the link (lib/family.ts).

import { useActionState } from 'react';
import { Button, inputClass } from '@/components/ui';
import { addParent, cancelParentInvite, type ParentState } from './family-actions';

export function FamilyCard({ parentName, invitedEmail }: { parentName: string | null; invitedEmail: string | null }) {
  const [state, action, pending] = useActionState<ParentState, FormData>(addParent, undefined);

  if (parentName) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <span className="size-2 rounded-full bg-[#60a5fa]" aria-hidden="true" />
        You’re in <span className="font-medium text-ink">{parentName}</span>’s family. They can book sessions for you and see your results.
      </p>
    );
  }

  if (invitedEmail) {
    return (
      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink-soft">
          <span className="font-medium text-ink">Waiting for {invitedEmail}.</span> As soon as they create an account or sign in
          with that email, you’ll be in their family.
        </p>
        <form action={cancelParentInvite}>
          <button className="text-sm text-muted underline underline-offset-4 hover:text-ink">Change</button>
        </form>
      </div>
    );
  }

  return (
    <section
      className="rounded-3xl p-6"
      style={{ background: 'color-mix(in srgb, #60a5fa 12%, var(--card))', border: '1.5px solid color-mix(in srgb, #60a5fa 45%, transparent)' }}
      aria-labelledby="family-title"
    >
      <h2 id="family-title" className="font-display text-2xl tracking-tight">
        Add your parent
      </h2>
      <p className="mt-1 text-ink-soft">They’ll be able to book and pay for your sessions. If they don’t have an account yet, they’ll see you when they sign up.</p>
      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required placeholder="parent@email.com" aria-label="Your parent’s email" className={inputClass} />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? 'Adding…' : 'Add parent'}
        </Button>
      </form>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-state-appeal">
          {state.error}
        </p>
      )}
    </section>
  );
}
