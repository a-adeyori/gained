// Home for every role, built around one question: what do I do next? Each session shows where it
// is (Booked → Warm-up → Session → Quiz → Check-in → Paid) and whose turn it is; new users get a
// step-by-step guide for their role.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JourneyBar, NextStepCard, RoleGuide, type GuideStep } from '@/components/journey';
import { EscrowBadge, Money } from '@/components/ui';
import { LocalTime } from '@/components/local-time';
import { requireUser, type CurrentUser } from '@/lib/auth';
import { normalizeSubjects } from '@/lib/booking';
import { db } from '@/lib/db';
import { checkInDone, type EscrowStateKey } from '@/lib/escrow-states';
import { nextStep, stageOf, stageStatuses, type NextStep } from '@/lib/journey';
import { quizToken } from '@/lib/signing';
import { DailyCard } from './daily-card';
import { FamilyCard } from './family-card';

export const metadata: Metadata = { title: 'Home' };


const hrefFor = (step: NextStep) =>
  step.kind === 'action' && step.quizId ? `/quiz/${step.quizId}?t=${quizToken(step.quizId)}` : step.kind === 'action' ? step.href : undefined;

export default async function HomePage() {
  const user = await requireUser();
  if (user.role === 'admin') redirect('/admin');

  const sessions = await db.session.findMany({
    where:
      user.role === 'tutor'
        ? { tutor_id: user.id }
        : { OR: [{ payer_id: user.id }, { student_id: user.id }] },
    include: { tutor: true, student: true, escrow: true, quizzes: true, result: true },
    orderBy: { start_at: 'desc' },
  });
  const live = sessions.filter((s) => s.status !== 'cancelled');
  const now = new Date();

  // Everything waiting on this person, soonest session first.
  const steps = live
    .map((s) => ({ session: s, step: nextStep(s, user.id, now) }))
    .filter((x): x is { session: (typeof live)[number]; step: NextStep } => x.step !== null);
  const todo = steps
    .filter((x) => x.step.kind === 'action' && stageOf(x.session) !== 'Paid')
    .sort((a, b) => a.session.start_at.getTime() - b.session.start_at.getTime());

  const upcoming = live.filter((s) => stageOf(s) !== 'Paid');
  const past = live.filter((s) => stageOf(s) === 'Paid');
  const first = user.name.split(' ')[0];

  // Family: a student's parent, or a parent's children (whoever added the other first).
  const parent =
    user.role === 'student' && user.parent_id
      ? await db.user.findUnique({ where: { id: user.parent_id }, select: { name: true } })
      : null;
  const children =
    user.role === 'parent'
      ? await db.user.findMany({ where: { parent_id: user.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : [];

  const daily =
    user.role === 'student'
      ? await db.dailyAttempt.findMany({ where: { user_id: user.id }, orderBy: { day: 'desc' } })
      : [];

  // Students see this above the daily problem: a session quiz matters more than a streak.
  const todoSection = todo.length > 0 && (
    <section className="space-y-3" aria-label="Your next steps">
      {user.role === 'student' && <h2 className="font-display text-3xl tracking-tight">Your next step</h2>}
      {todo.slice(0, 3).map(({ session, step }) => (
        <NextStepCard
          key={session.id}
          step={step}
          href={hrefFor(step)}
          stage={stageOf(session)}
          context={`${session.subject} · ${user.role === 'tutor' ? session.student.name : session.tutor.name}`}
        />
      ))}
    </section>
  );

  return (
    <div className="space-y-12">
      {user.role === 'student' && todoSection}
      {user.role === 'student' ? (
        <DailyCard
          name={first}
          attempts={daily.slice(0, 3).map((a) => ({ day: a.day, picks: a.picks, solved: a.solved_at !== null }))}
          solvedDays={daily.filter((a) => a.solved_at).map((a) => a.day)}
        />
      ) : (
        <header>
          <p className="text-sm font-medium text-muted">Hi {first} 👋</p>
          <h1 className="mt-1 font-display text-5xl tracking-tight sm:text-6xl">
            {todo.length ? `${todo.length} thing${todo.length > 1 ? 's' : ''} need${todo.length > 1 ? '' : 's'} you` : live.length ? 'You’re all caught up' : 'Let’s get you started'}
          </h1>
        </header>
      )}

      {user.role !== 'student' && todoSection}

      {user.role === 'student' && <FamilyCard parentName={parent?.name ?? null} invitedEmail={user.invited_parent_email} />}

      {user.role === 'parent' && children.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          Your family:
          {children.map((c) => (
            <span key={c.id} className="rounded-full bg-[#60a5fa]/15 px-3 py-1 font-medium text-ink">
              {c.name}
            </span>
          ))}
        </p>
      )}

      <Guide user={user} sessionCount={live.length} hasPaid={live.some((s) => s.escrow)} childCount={children.length} />

      <SessionList
        title="In progress"
        sessions={upcoming}
        viewer={user}
        steps={new Map(steps.map((x) => [x.session.id, x.step]))}
      />
      <SessionList title="Finished" sessions={past} viewer={user} steps={new Map()} />
    </div>
  );
}

/** The role's how-it-works, shown until they've been through it once. */
async function Guide({
  user,
  sessionCount,
  hasPaid,
  childCount,
}: {
  user: CurrentUser;
  sessionCount: number;
  hasPaid: boolean;
  childCount: number;
}) {
  if (user.role === 'tutor') {
    const slots = await db.availability.count({ where: { tutor_id: user.id } });
    const profile = Boolean(user.price_cents) && normalizeSubjects(user.subjects).length > 0;
    if (profile && slots > 0 && sessionCount > 0) return null;
    const steps: GuideStep[] = [
      { title: 'Set your price and subjects', detail: 'Families only see tutors with both filled in.', done: profile, href: '/tutor/availability', cta: 'Set up profile' },
      { title: 'Add your availability', detail: 'Drag on the calendar to open times families can book.', done: slots > 0, href: '/tutor/availability', cta: 'Add times' },
      { title: 'Get booked', detail: 'A family picks a time and approves a PayPal hold. It shows up here.', done: sessionCount > 0 },
      { title: 'Teach, then get paid', detail: 'Run the session, confirm topics. 80% is paid right after; up to 20% more from the quizzes.' },
    ];
    return <RoleGuide title="Start tutoring in 4 steps" steps={steps} />;
  }

  if (user.role === 'parent') {
    if (hasPaid) return null;
    const steps: GuideStep[] = [
      { title: 'Add your child', detail: 'Add their email when you book, or they can add yours from their own account.', done: childCount > 0 || sessionCount > 0, href: '/book', cta: 'Add a child' },
      { title: 'Book a tutor', detail: 'Pick a subject, a tutor and a time on the calendar.', done: sessionCount > 0, href: '/book', cta: 'Find a tutor' },
      { title: 'Approve the hold', detail: 'PayPal holds the price. Nothing is charged yet.', done: hasPaid },
      { title: 'Watch the progress', detail: 'Quizzes before and after show what they learned. Unearned money comes back.' },
    ];
    return <RoleGuide title="How it works" steps={steps} />;
  }

  // Students: what happens around each session.
  if (sessionCount > 0) return null;
  return (
    <RoleGuide
      title="How your sessions work"
      steps={[
        { title: 'Warm-up quiz', detail: '5 quick questions before the session, so your progress can be measured.' },
        { title: 'The session', detail: 'Learn live with your tutor.' },
        { title: 'Quick quiz', detail: 'Fresh questions on what you covered, right after.' },
        { title: '48-hour check-in', detail: 'One last short quiz two days later to show what stuck.' },
      ]}
    />
  );
}

type Row = Awaited<ReturnType<typeof db.session.findMany<{ include: { tutor: true; student: true; escrow: true; quizzes: true; result: true } }>>>[number];

function SessionList({ title, sessions, viewer, steps }: { title: string; sessions: Row[]; viewer: CurrentUser; steps: Map<string, NextStep> }) {
  if (!sessions.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
        {sessions.map((s) => {
          const step = steps.get(s.id);
          const href = step?.kind === 'action' && step.href.endsWith('/live') ? step.href : `/sessions/${s.id}`;
          return (
            <li key={s.id}>
              <Link href={href} className="grid gap-3 px-5 py-4 hover:bg-surface-2 sm:grid-cols-[1fr_15rem_15rem] sm:items-center sm:gap-6">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.subject} · {viewer.role === 'tutor' ? s.student.name : `with ${s.tutor.name}`}
                    {viewer.role === 'parent' && s.student_id !== viewer.id && <span className="text-muted"> for {s.student.name.split(' ')[0]}</span>}
                  </p>
                  <p className="text-sm text-muted"><LocalTime iso={s.start_at.toISOString()} /></p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <JourneyBar stages={stageStatuses(s)} compact />
                  <p className={`text-xs ${step?.kind === 'action' ? 'font-semibold text-ink' : 'text-muted'}`}>
                    {stageOf(s)}
                    {step ? ` · ${step.kind === 'action' ? `Your turn: ${step.title}` : step.title}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  {s.result?.pre_score != null && s.result?.post_score != null && (
                    <span className="num whitespace-nowrap text-sm text-ink-soft">
                      {Math.round(s.result.pre_score)}% →{' '}
                      {/* Green means progress, so only an improved score is green. */}
                      <span className={`font-medium ${s.result.post_score > s.result.pre_score ? 'text-gain-ink' : 'text-ink'}`}>
                        {Math.round(s.result.post_score)}%
                      </span>
                    </span>
                  )}
                  <Money cents={s.price_cents} className="text-sm text-ink-soft" />
                  {s.escrow && <EscrowBadge state={s.escrow.state as EscrowStateKey} checkInDone={checkInDone(s.quizzes.find((q) => q.kind === 'retention'))} />}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
