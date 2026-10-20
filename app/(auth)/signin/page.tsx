import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  const { link } = await searchParams;
  const message =
    link === 'expired' ? 'That link has expired or was already replaced. Sign in, and we can send you a new one.' : undefined;
  return <AuthForm mode="signin" message={message} />;
}
