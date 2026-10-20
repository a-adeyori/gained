import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({ searchParams }: PageProps<'/signup'>) {
  const { role, email } = await searchParams;
  const initialRole = role === 'tutor' || role === 'parent' ? role : 'student';
  // Links in family emails pre-fill the address they were sent to.
  return <AuthForm mode="signup" initialRole={initialRole} initialEmail={typeof email === 'string' ? email : undefined} />;
}
