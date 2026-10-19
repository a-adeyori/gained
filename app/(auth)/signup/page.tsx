import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({ searchParams }: PageProps<'/signup'>) {
  const { role } = await searchParams;
  const initialRole = role === 'tutor' || role === 'parent' ? role : 'student';
  return <AuthForm mode="signup" initialRole={initialRole} />;
}
