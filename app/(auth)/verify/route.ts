// GET /verify?t=…: the link emailed at sign-up. Confirms the address, signs the person in (the
// link proves they own it), and links any students who added this parent's email first.

import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { startSession } from '@/lib/auth';
import { confirmEmail } from '@/lib/verification';

export async function GET(request: NextRequest) {
  const user = await confirmEmail(request.nextUrl.searchParams.get('t') ?? undefined);
  if (!user) redirect('/signin?link=expired');
  await startSession(user.id);
  redirect('/home?verified=1');
}
