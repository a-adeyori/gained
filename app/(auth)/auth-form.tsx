'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button, Field, inputClass, Logo } from '@/components/ui';
import { signIn, signUp } from './actions';

type SignUpRole = 'student' | 'parent' | 'tutor';
const ROLES: { role: SignUpRole; label: string; hint: string }[] = [
  { role: 'student', label: 'Student', hint: 'I take sessions' },
  { role: 'parent', label: 'Parent', hint: 'I book for my child' },
  { role: 'tutor', label: 'Tutor', hint: 'I teach' },
];

export function AuthForm({
  mode,
  initialRole,
  initialEmail,
  message,
}: {
  mode: 'signin' | 'signup';
  initialRole?: SignUpRole;
  initialEmail?: string;
  /** Shown above the form, e.g. when an emailed link has expired. */
  message?: string;
}) {
  const [state, action, pending] = useActionState(mode === 'signin' ? signIn : signUp, undefined);
  const [role, setRole] = useState<SignUpRole | null>(initialRole ?? null);
  // Set when someone tries to sign up before choosing a role.
  const [roleMissing, setRoleMissing] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-10 self-start">
        <Logo />
      </Link>
      <h1 className="font-display text-4xl tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="mt-2 text-ink-soft">
        {mode === 'signin'
          ? 'Sign in to see your sessions, quizzes and streak.'
          : role === 'student'
            ? 'Daily problems, streaks and your session quizzes.'
            : role === 'parent'
              ? 'Book tutors. Pay only for real progress.'
              : role === 'tutor'
                ? 'Get paid more when your students learn more.'
                : 'Start by choosing who you are.'}
      </p>

      {message && !state && (
        <p role="status" className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          {message}
        </p>
      )}

      <form
        action={action}
        onSubmit={(e) => {
          if (mode === 'signup' && !role) {
            e.preventDefault();
            setRoleMissing(true);
          }
        }}
        className="mt-8 space-y-4"
      >
        {mode === 'signup' && (
          <>
            <fieldset>
              <legend id="role-label" className="mb-2 text-sm font-medium text-ink">
                I’m joining as a…
              </legend>
              <div
                role="radiogroup"
                aria-labelledby="role-label"
                aria-describedby={roleMissing ? 'role-missing' : undefined}
                className="grid grid-cols-3 gap-2"
              >
                {ROLES.map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    role="radio"
                    aria-checked={role === r.role}
                    onClick={() => {
                      setRole(r.role);
                      setRoleMissing(false);
                    }}
                    className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 text-center transition ${
                      role === r.role
                        ? 'border-ink bg-card shadow-sm'
                        : roleMissing
                          ? 'border-state-appeal bg-surface-2 hover:border-ink'
                          : 'border-line bg-surface-2 hover:border-line-strong'
                    }`}
                  >
                    <span className="text-[15px] font-semibold text-ink">{r.label}</span>
                    <span className="mt-0.5 text-xs leading-tight text-muted">{r.hint}</span>
                  </button>
                ))}
              </div>
              {roleMissing && (
                <p id="role-missing" role="alert" className="mt-2 text-sm text-state-appeal">
                  Choose whether you’re a student, parent or tutor.
                </p>
              )}
            </fieldset>
            <input type="hidden" name="role" value={role ?? ''} />
            <Field label="Name">
              <input name="name" autoComplete="name" required className={inputClass} />
            </Field>
          </>
        )}
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required defaultValue={initialEmail} className={inputClass} />
        </Field>
        <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            className={inputClass}
          />
        </Field>
        {mode === 'signin' && (
          <Link href="/forgot-password" className="-mt-2 inline-block text-sm text-muted underline underline-offset-4 hover:text-ink">
            Forgot password?
          </Link>
        )}
        {state?.error && (
          <p role="alert" className="text-sm text-state-appeal">
            {state.error}
          </p>
        )}
        {state?.notice && (
          <p role="status" className="rounded-xl bg-gain-soft px-4 py-3 text-sm text-gain-ink">
            {state.notice}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        {mode === 'signup' && (
          <p className="text-xs text-muted">
            By creating an account you agree to the{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-ink">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
              privacy policy
            </Link>
            .
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-muted">
        {mode === 'signin' ? (
          <>
            New here?{' '}
            <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/signin" className="font-medium text-ink underline underline-offset-4">
              Sign in
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
