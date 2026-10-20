import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  const { link } = await searchParams;
  const message =
    link === 'expired'
      ? 'That link has expired. Sign in to get a new confirmation link, or use “Forgot password?” if you can’t.'
      : undefined;
  return <AuthForm mode="signin" message={message} />;
}
