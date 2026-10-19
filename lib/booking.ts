// Booking rules: availability ranges, slot fit, overlap and price. Pure functions (no
// database), so the server actions, API routes and tests all share the same checks.

/** Every subject tutors can offer. Stored on sessions exactly as written here. */
export const SUBJECTS = [
  'Math',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Writing',
  'History',
  'Spanish',
  'French',
  'Computer Science',
  'Economics',
  'Test Prep',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const DURATIONS = [30, 60, 90] as const;
export type Duration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: Duration = 60;

/** Start times are offered on this grid inside an availability range. */
export const SLOT_STEP_MINUTES = 30;

/** A booked session whose hold was never approved stops blocking its slot after this long. */
export const PENDING_HOLD_MINUTES = 30;

export const MIN_AVAILABILITY_MINUTES = 30;
export const MAX_AVAILABILITY_HOURS = 12;
export const MAX_TOPICS_LENGTH = 300;
export const MIN_PRICE_CENTS = 1000;
export const MAX_PRICE_CENTS = 50000;

const MINUTE = 60_000;

export type TimeRange = { start_at: Date; end_at: Date };

export type SessionSlot = TimeRange & {
  id?: string;
  status: string;
  created_at: Date;
  has_escrow: boolean;
};

export const isSubject = (s: unknown): s is Subject => SUBJECTS.includes(s as Subject);
export const isDuration = (n: unknown): n is Duration => DURATIONS.includes(n as Duration);

/** Keeps only known subjects, in their canonical spelling, without duplicates. */
export function normalizeSubjects(list: string[]): Subject[] {
  const wanted = new Set(list.map((s) => s.trim().toLowerCase()));
  return SUBJECTS.filter((s) => wanted.has(s.toLowerCase()));
}

/** Half-open ranges: one that ends at 3:00 doesn't overlap one that starts at 3:00. */
export const overlaps = (a: TimeRange, b: TimeRange) => a.start_at < b.end_at && b.start_at < a.end_at;

/** Tutors set a 60-minute price; other durations are prorated to the cent. */
export const prorateCents = (hourCents: number, minutes: number) => Math.round((hourCents * minutes) / 60);

/** "45", "45.5", "$45.50" -> cents. Null if it isn't a sensible amount. */
export function parseDollars(input: string): number | null {
  const s = input.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/**
 * Whether a session holds its slot: anything not cancelled with an approved hold, plus
 * very recent unapproved bookings so two families can't check out the same time at once.
 */
export function isBlocking(s: SessionSlot, now: Date): boolean {
  if (s.status === 'cancelled') return false;
  if (s.has_escrow) return true;
  return s.created_at.getTime() > now.getTime() - PENDING_HOLD_MINUTES * MINUTE;
}

export function findContainingRange<R extends TimeRange>(ranges: R[], slot: TimeRange): R | undefined {
  return ranges.find((r) => r.start_at <= slot.start_at && slot.end_at <= r.end_at);
}

/** Start times inside `range` where a session of `minutes` fits, is in the future and is free. */
export function openStarts(range: TimeRange, minutes: number, sessions: SessionSlot[], now: Date): Date[] {
  const blocking = sessions.filter((s) => isBlocking(s, now));
  const starts: Date[] = [];
  for (let t = range.start_at.getTime(); t + minutes * MINUTE <= range.end_at.getTime(); t += SLOT_STEP_MINUTES * MINUTE) {
    const slot = { start_at: new Date(t), end_at: new Date(t + minutes * MINUTE) };
    if (slot.start_at <= now) continue;
    if (blocking.some((s) => overlaps(s, slot))) continue;
    starts.push(slot.start_at);
  }
  return starts;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** A tutor adding an availability range. `existing` is their other ranges. */
export function validateAvailability(range: TimeRange, existing: TimeRange[], now: Date): Result<object> {
  const { start_at, end_at } = range;
  if (Number.isNaN(start_at.getTime()) || Number.isNaN(end_at.getTime())) return { ok: false, error: 'Pick a start and end time.' };
  if (end_at <= start_at) return { ok: false, error: 'The end time has to be after the start time.' };
  if (start_at <= now) return { ok: false, error: 'Availability has to be in the future.' };
  const minutes = (end_at.getTime() - start_at.getTime()) / MINUTE;
  if (minutes < MIN_AVAILABILITY_MINUTES) return { ok: false, error: `Make the range at least ${MIN_AVAILABILITY_MINUTES} minutes.` };
  if (minutes > MAX_AVAILABILITY_HOURS * 60) return { ok: false, error: `Keep each range under ${MAX_AVAILABILITY_HOURS} hours.` };
  if (existing.some((r) => overlaps(r, range))) return { ok: false, error: 'That overlaps a range you already added.' };
  return { ok: true };
}

export type BookingRequest = {
  tutorId: string;
  studentId: string;
  startAt: Date;
  durationMin: number;
  subject: string;
  plannedTopics: string;
};

export type BookingContext = {
  now: Date;
  payerId: string;
  /** IDs of students whose parent is the payer. */
  childIds: string[];
  tutor: { id: string; role: string; subjects: string[]; price_cents: number | null } | null;
  /** The tutor's availability ranges. */
  availability: TimeRange[];
  /** The tutor's sessions near the requested time (any status; blocking is decided here). */
  sessions: SessionSlot[];
};

/** Every check a booking must pass on the server. Returns the end time and price to store. */
export function validateBooking(req: BookingRequest, ctx: BookingContext): Result<{ endAt: Date; priceCents: number; plannedTopics: string }> {
  const { tutor } = ctx;
  if (!tutor || tutor.role !== 'tutor' || tutor.id !== req.tutorId) return { ok: false, error: 'That tutor isn’t available.' };
  if (!tutor.price_cents || tutor.price_cents <= 0) return { ok: false, error: 'That tutor hasn’t set a price yet.' };
  if (req.studentId !== ctx.payerId && !ctx.childIds.includes(req.studentId)) {
    return { ok: false, error: 'Choose who the session is for.' };
  }
  if (!isSubject(req.subject)) return { ok: false, error: 'Pick a subject.' };
  if (!normalizeSubjects(tutor.subjects).includes(req.subject)) {
    return { ok: false, error: `This tutor doesn’t teach ${req.subject}.` };
  }
  const plannedTopics = req.plannedTopics.trim();
  if (!plannedTopics) return { ok: false, error: 'Tell the tutor what you want to cover.' };
  if (plannedTopics.length > MAX_TOPICS_LENGTH) return { ok: false, error: `Keep the topics under ${MAX_TOPICS_LENGTH} characters.` };
  if (!isDuration(req.durationMin)) return { ok: false, error: 'Pick 30, 60 or 90 minutes.' };
  if (Number.isNaN(req.startAt.getTime())) return { ok: false, error: 'Pick a start time.' };
  if (req.startAt <= ctx.now) return { ok: false, error: 'That time has already passed. Pick a later one.' };

  const slot = { start_at: req.startAt, end_at: new Date(req.startAt.getTime() + req.durationMin * MINUTE) };
  if (!findContainingRange(ctx.availability, slot)) {
    return { ok: false, error: 'That doesn’t fit inside the tutor’s open time. Try a shorter session or an earlier start.' };
  }
  if (ctx.sessions.some((s) => isBlocking(s, ctx.now) && overlaps(s, slot))) {
    return { ok: false, error: 'Someone already booked that time. Pick another slot.' };
  }
  return { ok: true, endAt: slot.end_at, priceCents: prorateCents(tutor.price_cents, req.durationMin), plannedTopics };
}

/**
 * Before placing a hold on an existing, not-yet-approved booking: it must still be in the
 * future and must not clash with a session that blocked the slot in the meantime.
 */
export function checkStillBookable(session: SessionSlot & { id: string }, others: SessionSlot[], now: Date): Result<object> {
  if (session.status === 'cancelled') return { ok: false, error: 'This booking was cancelled. Nothing was charged.' };
  if (session.start_at <= now) return { ok: false, error: 'This session’s start time has passed. Nothing was charged; please book a new time.' };
  const clash = others.some((s) => s.id !== session.id && isBlocking(s, now) && overlaps(s, session));
  if (clash) return { ok: false, error: 'Someone else booked this time while checkout was open. Nothing was charged; please pick another slot.' };
  return { ok: true };
}
