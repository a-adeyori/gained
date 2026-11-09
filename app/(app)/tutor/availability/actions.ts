'use server';

// Tutor server actions: add and remove availability ranges, and save the booking profile.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { isBlocking, MAX_PRICE_CENTS, MIN_PRICE_CENTS, normalizeSubjects, overlaps, parseDollars, validateAvailability } from '@/lib/booking';
import { db } from '@/lib/db';
import { formatUsd } from '@/lib/escrow-states';
import { parseMeetingLink } from '@/lib/meeting';
import { tutorSessionsAround } from '@/app/(app)/book/queries';

export type ActionResult = { error?: string; ok?: boolean } | undefined;

const PATH = '/tutor/availability';

async function tutor() {
  const user = await currentUser();
  return user?.role === 'tutor' ? user : null;
}

export async function addAvailability(startIso: string, endIso: string): Promise<ActionResult> {
  const user = await tutor();
  if (!user) return { error: 'Sign in as a tutor to add availability.' };
  const range = { start_at: new Date(startIso), end_at: new Date(endIso) };
  const existing = Number.isNaN(range.start_at.getTime() + range.end_at.getTime())
    ? []
    : await db.availability.findMany({
        where: { tutor_id: user.id, start_at: { lt: range.end_at }, end_at: { gt: range.start_at } },
        select: { start_at: true, end_at: true },
      });
  const check = validateAvailability(range, existing, new Date());
  if (!check.ok) return { error: check.error };
  await db.availability.create({ data: { tutor_id: user.id, ...range } });
  revalidatePath(PATH);
  revalidatePath('/book');
  return { ok: true };
}

export async function removeAvailability(id: string): Promise<ActionResult> {
  const user = await tutor();
  if (!user) return { error: 'Sign in as a tutor to change availability.' };
  const range = await db.availability.findUnique({ where: { id } });
  if (!range || range.tutor_id !== user.id) return { error: 'That range is already gone.' };
  // Booked sessions keep their time; the tutor has to keep the range that holds them.
  const sessions = await tutorSessionsAround(user.id, range.start_at, range.end_at);
  const now = new Date();
  if (sessions.some((s) => isBlocking(s, now) && overlaps(s, range))) {
    return { error: 'A session is booked inside this range, so it can’t be removed.' };
  }
  await db.availability.delete({ where: { id } });
  revalidatePath(PATH);
  revalidatePath('/book');
  return { ok: true };
}

const Profile = z.object({
  price: z.string(),
  bio: z.string().trim().max(600, 'Keep the bio under 600 characters.'),
  meetingLink: z
    .string({ error: 'Paste your Zoom or Google Meet link.' })
    .trim()
    .min(1, 'Paste your Zoom or Google Meet link.')
    .max(300, 'That link is too long.'),
  paypalEmail: z.email('Enter the email of your PayPal account.').transform((e) => e.toLowerCase()),
});

export async function saveProfile(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await tutor();
  if (!user) return { error: 'Sign in as a tutor to edit your profile.' };
  const parsed = Profile.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const priceCents = parseDollars(parsed.data.price);
  if (priceCents === null || priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS) {
    return { error: `Set a price between ${formatUsd(MIN_PRICE_CENTS)} and ${formatUsd(MAX_PRICE_CENTS)} per hour.` };
  }
  const subjects = normalizeSubjects(form.getAll('subjects').map(String));
  if (!subjects.length) return { error: 'Pick at least one subject.' };
  const link = parseMeetingLink(parsed.data.meetingLink);
  if (!link.ok) return { error: link.error };
  await db.user.update({
    where: { id: user.id },
    data: {
      price_cents: priceCents,
      subjects,
      bio: parsed.data.bio || null,
      meeting_link: link.link,
      paypal_email: parsed.data.paypalEmail,
    },
  });
  revalidatePath(PATH);
  revalidatePath('/book');
  return { ok: true };
}
