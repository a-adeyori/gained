'use client';

// The booking screen's interactive part: the tutor calendar, a list of open times for
// small screens, and the booking sheet (side sheet on desktop, bottom sheet on phones).

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useMemo, useState } from 'react';
import { BookingScheduler, OPEN_COLOR, type CalendarRange, type CalendarSession, type CalendarTutor } from '@/components/scheduler';
import { Button, Card, cx, Field, inputClass, Money } from '@/components/ui';
import { DEFAULT_DURATION, DURATIONS, MAX_TOPICS_LENGTH, openStarts, prorateCents, type Duration, type SessionSlot } from '@/lib/booking';
import { ESCROW_STATE_HEX } from '@/lib/escrow-states';
import { addChild, bookSession, type ChildState } from './actions';

type Person = { id: string; name: string; isMinor: boolean };

export type BookingBoardProps = {
  tutors: CalendarTutor[];
  ranges: CalendarRange[];
  sessions: (CalendarSession & { blocks: boolean })[];
  me: { id: string; name: string };
  family: Person[];
};

type Selection = { tutor: CalendarTutor; range: CalendarRange; clicked: Date };

const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export default function BookingBoard({ tutors, ranges, sessions, me, family }: BookingBoardProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Fixed when the board loads; the server re-checks every time on submit anyway.
  const [now] = useState(() => new Date());

  const tutorById = useMemo(() => new Map(tutors.map((t) => [t.id, t])), [tutors]);
  const busyByTutor = useMemo(() => {
    const map = new Map<string, SessionSlot[]>();
    for (const s of sessions) {
      if (!s.blocks) continue;
      const list = map.get(s.tutorId) ?? [];
      // Already filtered to blocking sessions on the server, so mark them as held.
      list.push({ start_at: new Date(s.start), end_at: new Date(s.end), status: 'booked', created_at: now, has_escrow: true });
      map.set(s.tutorId, list);
    }
    return map;
  }, [sessions, now]);

  const openRanges = useMemo(
    () =>
      ranges.filter((r) =>
        openStarts({ start_at: new Date(r.start), end_at: new Date(r.end) }, 30, busyByTutor.get(r.tutorId) ?? [], now).length > 0,
      ),
    [ranges, busyByTutor, now],
  );

  function openAt(tutorId: string, date: Date) {
    const tutor = tutorById.get(tutorId);
    const range = openRanges.find((r) => r.tutorId === tutorId && new Date(r.start) <= date && date < new Date(r.end));
    if (!tutor || !range) {
      setNotice('That time isn’t open. Tap inside a shaded block, or pick from the list below.');
      return;
    }
    setNotice(null);
    setSelection({ tutor, range, clicked: date });
  }

  function openSession(s: CalendarSession) {
    if (s.href) router.push(s.href);
    else setNotice('That time is already booked. Pick another slot.');
  }

  if (tutors.length === 0) {
    return (
      <Card>
        <p className="font-medium">No tutors have opened times yet.</p>
        <p className="mt-1 text-sm text-muted">Check back soon. New times appear here as soon as a tutor adds them.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="gained-scheduler h-[420px] sm:h-[520px]">
          <BookingScheduler tutors={tutors} ranges={ranges} sessions={sessions} onSlotClick={openAt} onSessionClick={openSession} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <Swatch color={OPEN_COLOR} label="Open time" soft />
          <Swatch color={ESCROW_STATE_HEX.held} label="Booked" />
          <span>Your own sessions show their payment state.</span>
        </div>
        {notice && (
          <p role="status" className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
            {notice}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Open times</h2>
        <ul className="space-y-3">
          {tutors.map((t) => {
            const mine = openRanges.filter((r) => r.tutorId === t.id).slice(0, 6);
            return (
              <li key={t.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-ink-soft">
                      {t.subjects.join(', ')} · <Money cents={t.priceCents} />
                      /hr
                    </p>
                  </div>
                  {mine.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mine.map((r) => {
                        const start = new Date(r.start);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => openAt(t.id, start > now ? start : now)}
                            className="min-h-11 rounded-full border border-line-strong px-4 text-sm hover:bg-surface-2"
                          >
                            {dayLabel(start)} · {timeLabel(start)}–{timeLabel(new Date(r.end))}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">No open times in the next two weeks.</p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {selection && (
        <BookingSheet
          key={`${selection.range.id}-${selection.clicked.getTime()}`}
          selection={selection}
          busy={busyByTutor.get(selection.tutor.id) ?? []}
          now={now}
          me={me}
          family={family}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}

function Swatch({ color, label, soft }: { color: string; label: string; soft?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-3 rounded" style={{ background: soft ? `color-mix(in srgb, ${color} 35%, transparent)` : color }} />
      {label}
    </span>
  );
}

function BookingSheet({
  selection,
  busy,
  now,
  me,
  family,
  onClose,
}: {
  selection: Selection;
  busy: SessionSlot[];
  now: Date;
  me: { id: string; name: string };
  family: Person[];
  onClose: () => void;
}) {
  const { tutor, range, clicked } = selection;
  const ids = useId();
  const titleId = `${ids}-title`;

  const startsFor = useMemo(() => {
    const r = { start_at: new Date(range.start), end_at: new Date(range.end) };
    return Object.fromEntries(DURATIONS.map((d) => [d, openStarts(r, d, busy, now)])) as Record<Duration, Date[]>;
  }, [range, busy, now]);
  const fits = DURATIONS.filter((d) => startsFor[d].length > 0);

  const nearest = (list: Date[], target: Date) => list.find((d) => d.getTime() >= target.getTime() - 30 * 60_000) ?? list[0];
  const [duration, setDuration] = useState<Duration>(fits.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : (fits[0] ?? DEFAULT_DURATION));
  const [start, setStart] = useState<Date | undefined>(() => nearest(startsFor[duration], clicked));

  const [added, setAdded] = useState<Person[]>([]);
  const people: Person[] = [{ id: me.id, name: me.name, isMinor: false }, ...family, ...added.filter((a) => !family.some((f) => f.id === a.id))];
  const [studentId, setStudentId] = useState(family[0]?.id ?? me.id);
  const student = people.find((p) => p.id === studentId) ?? people[0];
  const [adding, setAdding] = useState(false);

  const [childState, childAction, childPending] = useActionState(async (prev: ChildState, form: FormData) => {
    const result = await addChild(prev, form);
    if (result?.child) {
      const child = result.child;
      setAdded((list) => [...list, child]);
      setStudentId(child.id);
      setAdding(false);
    }
    return result;
  }, undefined);
  const [bookState, bookAction, bookPending] = useActionState(bookSession, undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function chooseDuration(d: Duration) {
    setDuration(d);
    if (!start || !startsFor[d].some((s) => s.getTime() === start.getTime())) setStart(nearest(startsFor[d], start ?? clicked));
  }

  const end = start ? new Date(start.getTime() + duration * 60_000) : undefined;
  const priceCents = prorateCents(tutor.priceCents, duration);

  const consentCopy =
    student.id === me.id
      ? 'I consent to this session being recorded for quiz generation; audio is deleted right after transcription.'
      : student.isMinor
        ? 'I’m the parent or guardian and I consent to this session being recorded for quiz generation; audio is deleted right after transcription.'
        : `${student.name.split(' ')[0]} consents to this session being recorded for quiz generation; audio is deleted right after transcription.`;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-card px-4 pb-8 pt-3 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:border-l sm:border-t-0 sm:px-6 sm:pt-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Book a session with</p>
            <h2 id={titleId} className="font-display text-3xl leading-tight">
              {tutor.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink">
            Close
          </button>
        </div>

        {fits.length === 0 ? (
          <p className="text-sm text-ink-soft">This block just filled up. Close this and pick another time.</p>
        ) : (
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">How long</legend>
              <div className="grid grid-cols-3 gap-2 rounded-full bg-surface-2 p-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={!fits.includes(d)}
                    aria-pressed={duration === d}
                    onClick={() => chooseDuration(d)}
                    className={cx(
                      'min-h-10 rounded-full text-sm font-medium transition disabled:opacity-40',
                      duration === d ? 'bg-card shadow-sm' : 'text-muted',
                    )}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label={`Start time · ${dayLabel(new Date(range.start))}`} hint={end && start ? `Ends at ${timeLabel(end)}` : undefined}>
              <select
                className={inputClass}
                value={start?.toISOString() ?? ''}
                onChange={(e) => setStart(new Date(e.target.value))}
              >
                {startsFor[duration].map((s) => (
                  <option key={s.toISOString()} value={s.toISOString()}>
                    {timeLabel(s)}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Who is it for?</legend>
              <div className="space-y-2">
                {people.map((p) => (
                  <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 has-checked:border-ink">
                    <input type="radio" name={`${ids}-student`} checked={studentId === p.id} onChange={() => setStudentId(p.id)} />
                    <span className="flex-1">{p.id === me.id ? `Me (${p.name})` : p.name}</span>
                    {p.isMinor && <span className="text-xs text-muted">Under 18</span>}
                  </label>
                ))}
              </div>
              {adding ? (
                <form action={childAction} className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3.5">
                  <Field label="Their name">
                    <input name="name" required autoComplete="off" className={inputClass} />
                  </Field>
                  <Field label="Their email" hint="Quiz links go here. If they already have a student account, it’s added to your family.">
                    <input name="email" type="email" required autoComplete="off" className={inputClass} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="minor" defaultChecked /> They’re under 18
                  </label>
                  {childState?.error && (
                    <p role="alert" className="text-sm text-state-appeal">
                      {childState.error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={childPending}>
                      {childPending ? 'Adding…' : 'Add'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="mt-2 min-h-11 text-sm font-medium text-ink underline underline-offset-4">
                  Add a child
                </button>
              )}
            </fieldset>

            <form action={bookAction} className="space-y-6">
              <input type="hidden" name="tutorId" value={tutor.id} />
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="startAt" value={start?.toISOString() ?? ''} />
              <input type="hidden" name="durationMin" value={duration} />

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Subject</legend>
                <div className="flex flex-wrap gap-2">
                  {tutor.subjects.map((s, i) => (
                    <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 has-checked:border-ink">
                      <input type="radio" name="subject" value={s} defaultChecked={i === 0} />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field label="What should the session cover?" hint="The warm-up quiz is written from this.">
                <textarea
                  name="plannedTopics"
                  required
                  maxLength={MAX_TOPICS_LENGTH}
                  rows={3}
                  placeholder="e.g. Factoring quadratics and the quadratic formula"
                  className={cx(inputClass, 'py-2.5')}
                />
              </Field>

              <div className="rounded-xl border border-line p-3.5">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="consent" className="mt-1" />
                  <span>{consentCopy}</span>
                </label>
                <p className="mt-2 pl-7 text-xs text-muted">
                  Optional. Leave it unchecked to skip recording; the tutor uses photos and notes instead.
                  {student.id !== me.id && !student.isMinor && ' Only check it if they’ve agreed. They also see a notice before recording starts.'}
                </p>
              </div>

              <div className="flex items-baseline justify-between border-t border-line pt-4">
                <span className="text-sm text-ink-soft">
                  {duration} min{start ? ` · ${dayLabel(start)}, ${timeLabel(start)}` : ''}
                </span>
                <Money cents={priceCents} className="text-xl font-semibold" />
              </div>
              <p className="-mt-4 text-xs text-muted">Held, not charged. You only pay for the part that’s earned.</p>

              {bookState?.error && (
                <p role="alert" className="text-sm text-state-appeal">
                  {bookState.error}
                </p>
              )}
              <Button type="submit" disabled={bookPending || !start} className="w-full">
                {bookPending ? 'Booking…' : 'Continue to PayPal'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
