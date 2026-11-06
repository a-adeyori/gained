import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({ searchParams }: PageProps<'/signup'>) {
  const { role, email } = await searchParams;
  // No role in the link: nothing is pre-selected, so people choose theirs on purpose.
  const initialRole = role === 'student' || role === 'tutor' || role === 'parent' ? role : undefined;
  // Links in family emails pre-fill the address they were sent to.
  return <AuthForm mode="signup" initialRole={initialRole} initialEmail={typeof email === 'string' ? email : undefined} />;
}
