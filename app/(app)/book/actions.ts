'use server';

// Booking server actions: add a child to the family, and create a session from an open slot.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { MAX_TOPICS_LENGTH, validateBooking } from '@/lib/booking';
import { db } from '@/lib/db';
import { decideAddChild } from '@/lib/family';
import { notifyFamily } from '@/lib/notify';
import { tutorSessionsAround } from './queries';

export type ChildState = { error?: string; child?: { id: string; name: string; isMinor: boolean } } | undefined;
export type BookState = { error?: string } | undefined;

const Child = z.object({
  name: z.string().trim().min(1, 'Enter their name').max(80),
  email: z.email('Enter a valid email for their quiz links').transform((e) => e.toLowerCase()),
  minor: z.literal('on').optional(),
});

export async function addChild(_prev: ChildState, form: FormData): Promise<ChildState> {
  const user = await currentUser();
  if (!user || user.role !== 'parent') return { error: 'Sign in as a parent to add a child.' };
  if (!user.email_verified_at) return { error: 'Confirm your email first: click the link we sent you (or resend it from the banner at the top).' };
  const parsed = Child.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, minor } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  const decision = decideAddChild(existing, user.id);

  if (decision.kind === 'error') return { error: decision.message };
  if (decision.kind === 'already-linked' && existing) {
    return { child: { id: existing.id, name: existing.name, isMinor: existing.is_minor } };
  }
  if (decision.kind === 'link' && existing) {
    // They added you (or nobody) first, so they join your family now. Only if still unlinked.
    const { count } = await db.user.updateMany({
      where: { id: existing.id, parent_id: null },
      data: { parent_id: user.id, is_minor: minor === 'on', invited_parent_email: null },
    });
    if (!count) return { error: 'That student is already part of another family.' };
    await notifyFamily('parent-added-you', { toEmail: existing.email, toName: existing.name, byName: user.name });
    revalidatePath('/book');
    return { child: { id: existing.id, name: existing.name, isMinor: minor === 'on' } };
  }

  const child = await db.user.create({
    data: { role: 'student', name, email, parent_id: user.id, is_minor: minor === 'on' },
  });
  await notifyFamily('account-created', { toEmail: email, toName: name, byName: user.name });
  revalidatePath('/book');
  return { child: { id: child.id, name: child.name, isMinor: child.is_minor } };
}

const Booking = z.object({
  tutorId: z.string().min(1),
  studentId: z.string().min(1, 'Choose who the session is for.'),
  startAt: z.iso.datetime({ offset: true, error: 'Pick a start time.' }),
  durationMin: z.coerce.number().int(),
  subject: z.string({ error: 'Pick a subject.' }),
  plannedTopics: z.string().max(MAX_TOPICS_LENGTH * 2),
  // Recording is how the quiz is written, so it's required. Audio is deleted once transcribed.
  consent: z.literal('on', { error: 'Agree to the recording to book. The audio is deleted as soon as it’s transcribed.' }),
});

export async function bookSession(_prev: BookState, form: FormData): Promise<BookState> {
  const user = await currentUser();
  if (!user || user.role !== 'parent') return { error: 'Sign in as a parent to book.' };
  const parsed = Booking.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const startAt = new Date(input.startAt);
  const endGuess = new Date(startAt.getTime() + 90 * 60_000);

  let sessionId: string;
  try {
    // Serializable so two families submitting the same slot at once can't both get it.
    sessionId = await db.$transaction(
      async (tx) => {
        const [tutor, children, availability] = await Promise.all([
          tx.user.findUnique({ where: { id: input.tutorId }, select: { id: true, role: true, subjects: true, price_cents: true } }),
          tx.user.findMany({ where: { parent_id: user.id, role: 'student' }, select: { id: true } }),
          tx.availability.findMany({
            where: { tutor_id: input.tutorId, start_at: { lte: startAt }, end_at: { gt: startAt } },
            select: { start_at: true, end_at: true },
          }),
        ]);
        const sessions = await tutorSessionsAround(input.tutorId, startAt, endGuess, tx);
        const check = validateBooking(
          { ...input, startAt },
          { now: new Date(), payerId: user.id, childIds: children.map((c) => c.id), tutor, availability, sessions },
        );
        if (!check.ok) throw new BookingError(check.error);
        const session = await tx.session.create({
          data: {
            tutor_id: input.tutorId,
            student_id: input.studentId,
            payer_id: user.id,
            start_at: startAt,
            end_at: check.endAt,
            price_cents: check.priceCents,
            subject: input.subject,
            planned_topics: check.plannedTopics,
            consent_recording: true,
            status: 'booked',
          },
        });
        return session.id;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error('Booking failed', err);
    return { error: 'That slot was just taken or something went wrong. Please pick a time again.' };
  }
  revalidatePath('/book');
  redirect(`/sessions/${sessionId}/checkout`);
}

class BookingError extends Error {}
