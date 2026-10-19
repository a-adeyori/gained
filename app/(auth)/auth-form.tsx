'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button, Field, inputClass, Logo } from '@/components/ui';
import { signIn, signUp } from './actions';

type SignUpRole = 'student' | 'parent' | 'tutor';
const ROLE_LABEL: Record<SignUpRole, string> = { student: 'Student', parent: 'Parent', tutor: 'Tutor' };

export function AuthForm({ mode, initialRole }: { mode: 'signin' | 'signup'; initialRole?: SignUpRole }) {
  const [state, action, pending] = useActionState(mode === 'signin' ? signIn : signUp, undefined);
  const [role, setRole] = useState<SignUpRole>(initialRole ?? 'student');

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
              : 'Get paid more when your students learn more.'}
      </p>

      <form action={action} className="mt-8 space-y-4">
        {mode === 'signup' && (
          <>
            <div role="radiogroup" aria-label="I am a" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
              {(['student', 'parent', 'tutor'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={`min-h-10 rounded-full text-sm font-medium transition ${role === r ? 'bg-card shadow-sm' : 'text-muted'}`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <input type="hidden" name="role" value={role} />
            <Field label="Name">
              <input name="name" autoComplete="name" required className={inputClass} />
            </Field>
          </>
        )}
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
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
        {state?.error && (
          <p role="alert" className="text-sm text-state-appeal">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
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
