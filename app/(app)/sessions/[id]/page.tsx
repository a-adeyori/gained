// PRD screen 6, the session result: before/after scores, gain, the AI's rationale (with every
// grade one tap away), and the animated money split. Also the session's status before then.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { JourneyBar, NextStepCard } from '@/components/journey';
import { LocalTime } from '@/components/local-time';
import { MathText } from '@/components/math-text';
import { MoneySplit } from '@/components/money-split';
import { ScoreBar } from '@/components/score-bar';
import { Button, ButtonLink, Card, EscrowBadge, HeldNotCharged, JoinMeeting, Money } from '@/components/ui';
import { canViewSession, requireUser } from '@/lib/auth';
import type { Question } from '@/lib/claude';
import { db } from '@/lib/db';
import { tutorAverageGain } from '@/lib/escrow';
import { checkInDone, ESCROW_STATES, type EscrowStateKey } from '@/lib/escrow-states';
import { baseCentsFor, computeSplit } from '@/lib/payout';
import { nextStep, stageOf, stageStatuses } from '@/lib/journey';
import { appealWindowClosesAt } from '@/lib/retention';
import { quizToken } from '@/lib/signing';
import { confirmSession } from './actions';

export const metadata: Metadata = { title: 'Session' };

export default async function SessionPage({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  const user = await requireUser();
  const session = await db.session.findUnique({
    where: { id },
    include: {
      tutor: true,
      student: true,
      escrow: true,
      result: true,
      quizzes: { include: { answers: { orderBy: { question_index: 'asc' } } } },
      appeals: { orderBy: { created_at: 'desc' } },
    },
  });
  if (!session || !canViewSession(user, session)) notFound();
  if (!session.escrow) {
    if (user.id === session.payer_id) redirect(`/sessions/${id}/checkout`);
    notFound();
  }

  const escrow = session.escrow;
  const state = escrow.state as EscrowStateKey;
  const result = session.result;
  const quiz = (kind: 'baseline' | 'post' | 'retention') => session.quizzes.find((q) => q.kind === kind);
  const baseline = quiz('baseline');
  const post = quiz('post');
  const isTutor = user.id === session.tutor_id;
  const isFamily = [session.payer_id, session.student_id].includes(user.id);
  const now = new Date();
  // After the check-in, the escrow still says "awaiting retention" until settlement; say what's really next.
  const finalising = state === 'awaiting_retention' && checkInDone(quiz('retention'), now) && session.ended_at !== null;
  const stateExplain = finalising ? (
    <>
      The 48-hour check-in is done. The final payment goes through once the appeal window closes on{' '}
      <LocalTime iso={appealWindowClosesAt(session.ended_at!).toISOString()} format="long" />.
    </>
  ) : (
    ESCROW_STATES[state].explain
  );

  // The split: final once settled; decided if an appeal set the tutor's pay (settlement pays
  // exactly that, lib/escrow.ts); otherwise an estimate from the scores so far.
  const base = baseCentsFor(session.price_cents);
  const overrideCents = result?.override_tutor_pay_cents ?? null;
  let split: { bonus: number; returned: number; provisional: boolean } | null = null;
  if ((state === 'settled' || state === 'returned') && result?.tutor_pay_cents != null) {
    split = { bonus: result.tutor_pay_cents - base, returned: escrow.returned_cents ?? session.price_cents - result.tutor_pay_cents, provisional: false };
  } else if (overrideCents !== null) {
    split = { bonus: overrideCents - base, returned: session.price_cents - overrideCents, provisional: false };
  } else if (result?.pre_score != null && result.post_score != null) {
    const estimate = computeSplit({
      priceCents: session.price_cents,
      preScore: result.pre_score,
      postScore: result.post_score,
      // Until the retention quiz, assume the gain holds.
      retentionScore: result.retention_score ?? result.post_score,
      tutorAverageGain: await tutorAverageGain(session.tutor_id, session.id),
    });
    split = { bonus: estimate.bonusCents, returned: estimate.returnedCents, provisional: true };
  }

  const openAppeal = session.appeals.find((a) => a.status === 'open');
  const canAppeal =
    !openAppeal &&
    session.ended_at &&
    now < appealWindowClosesAt(session.ended_at) &&
    !['settled', 'returned'].includes(state) &&
    (isFamily || isTutor);
  const needsFamilyConfirm = isFamily && session.tutor_confirmed_at && !session.family_confirmed_at;
  const awaitingTopics = isTutor && session.topics_json && !session.topics_confirmed_at;

  // Whose turn it is. Actions handled by a card on this page (confirming, results) aren't repeated.
  const step = nextStep(session, user.id, now);
  const stepHref =
    step?.kind === 'action' ? (step.quizId ? `/quiz/${step.quizId}?t=${quizToken(step.quizId)}` : step.href) : null;
  const showStep = step && (step.kind === 'wait' || (stepHref && stepHref !== `/sessions/${id}`));

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted">
          <LocalTime iso={session.start_at.toISOString()} format="long" /> · Online
        </p>
        <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          {session.subject} with {isTutor ? session.student.name : session.tutor.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <EscrowBadge state={state} checkInDone={finalising} />
          <span className="text-sm text-ink-soft">{stateExplain}</span>
        </div>
        {/* Until the session ends, the tutor's meeting link is how everyone gets there. */}
        {!session.ended_at && session.status !== 'cancelled' && <JoinMeeting link={session.tutor.meeting_link} className="mt-5" />}
        <div className="mt-8">
          <JourneyBar stages={stageStatuses(session)} />
        </div>
      </header>

      <div className="space-y-6">
        {showStep && step && <NextStepCard step={step} href={stepHref ?? undefined} stage={stageOf(session)} />}

        {awaitingTopics && !showStep && (
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>The topic list is ready. Confirm it so the quiz can be written.</p>
            <ButtonLink href={`/sessions/${id}/live`}>Confirm topics</ButtonLink>
          </Card>
        )}

        {needsFamilyConfirm && (
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Did the session happen?</p>
              <p className="text-sm text-muted">Confirming releases the 80% base to the tutor. It’s automatic after 24 hours.</p>
            </div>
            <form action={confirmSession.bind(null, id)}>
              <Button type="submit">Yes, it happened</Button>
            </form>
          </Card>
        )}

        {state === 'held' && isFamily && <HeldNotCharged cents={session.price_cents} />}

        {result?.pre_score != null && result.post_score != null ? (
          <Card className="space-y-8">
            <ScoreBar pre={result.pre_score} post={result.post_score} retention={result.retention_score} />
            {split && (
              <MoneySplit
                priceCents={session.price_cents}
                baseCents={base}
                bonusCents={split.bonus}
                returnedCents={split.returned}
                provisional={split.provisional}
              />
            )}
            {result.rationale && (
              <div className="border-t border-line pt-6">
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Why this result</h2>
                <p className="mt-2 leading-relaxed text-ink-soft">{result.rationale}</p>
              </div>
            )}
          </Card>
        ) : (
          <StatusCard
            session={session}
            baselineDone={!!baseline?.completed_at}
            postSent={!!post}
            isStudent={user.id === session.student_id}
            isTutorOrPayer={isTutor || user.id === session.payer_id}
            baselineLink={baseline && !baseline.completed_at ? `/quiz/${baseline.id}?t=${quizToken(baseline.id)}` : null}
            postLink={post && !post.completed_at ? `/quiz/${post.id}?t=${quizToken(post.id)}` : null}
          />
        )}

        {result?.pre_score == null && result?.post_score != null && (
          <Card>
            <p className="text-ink-soft">
              The baseline was skipped, so there’s no before score to compare. The bonus is based on {session.tutor.name}’s
              average measured gain instead.
            </p>
          </Card>
        )}

        {session.quizzes.some((q) => q.answers.length) && (
          <details className="group rounded-2xl border border-line bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 py-3 font-medium">
              How every answer was graded
              <span className="text-muted transition group-open:rotate-180" aria-hidden>
                ⌄
              </span>
            </summary>
            <div className="space-y-6 border-t border-line px-5 py-5">
              {(['baseline', 'post', 'retention'] as const).map((kind) => {
                const q = quiz(kind);
                if (!q?.answers.length) return null;
                const questions = q.questions_json as Question[];
                return (
                  <section key={kind}>
                    <h3 className="mb-2 flex items-baseline justify-between text-sm font-medium">
                      <span>{kind === 'baseline' ? 'Before the session' : kind === 'post' ? 'After the session' : '48 hours later'}</span>
                      {q.score != null && <span className="num text-muted">{Math.round(q.score)}%</span>}
                    </h3>
                    <ol className="space-y-3">
                      {q.answers.map((a) => (
                        <li key={a.question_index} className="rounded-xl bg-surface-2 p-3 text-sm">
                          <p>
                            <MathText text={questions[a.question_index]?.prompt ?? ''} />
                          </p>
                          <p className="mt-1 text-muted">
                            Answer:{' '}
                            {questions[a.question_index]?.type === 'multiple_choice'
                              ? questions[a.question_index].choices[Number(a.answer)] ?? a.answer
                              : a.answer || '(none)'}{' '}
                            ·{' '}
                            <span className={a.score === 1 ? 'text-gain-ink' : ''}>
                              {a.score === 1 ? 'right' : a.score && a.score > 0 ? 'partial credit' : 'not right'}
                            </span>
                          </p>
                          {a.rationale && (
                            <p className="mt-1 text-ink-soft">
                              <MathText text={a.rationale} />
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                );
              })}
            </div>
          </details>
        )}

        {openAppeal && (
          <Card className="border-state-appeal">
            <p className="font-medium">Appeal under review</p>
            <p className="mt-1 text-sm text-ink-soft">“{openAppeal.reason}”</p>
            <p className="mt-2 text-sm text-muted">The final payment waits until an admin reviews it.</p>
          </Card>
        )}
        {session.appeals
          .filter((a) => a.status !== 'open')
          .map((a) => (
            <Card key={a.id}>
              <p className="font-medium">Appeal {a.status === 'upheld' ? 'reviewed: grade stands' : 'reviewed: payment adjusted'}</p>
              {a.status === 'adjusted' && overrideCents !== null && (
                <p className="mt-1 text-sm">
                  The tutor’s pay for this session is now <Money cents={overrideCents} className="font-semibold" /> of the{' '}
                  <Money cents={session.price_cents} /> price
                  {overrideCents < session.price_cents ? (
                    <>
                      ; <Money cents={session.price_cents - overrideCents} className="font-semibold" /> comes back to the family
                    </>
                  ) : null}
                  . {state === 'settled' || state === 'returned' ? 'Paid out at settlement.' : 'It goes through at settlement, after the appeal window.'}
                </p>
              )}
              {a.resolution && <p className="mt-1 text-sm text-ink-soft">“{a.resolution}”</p>}
            </Card>
          ))}

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/home" className="text-muted underline underline-offset-4">
            Back to sessions
          </Link>
          {canAppeal && (
            <Link href={`/sessions/${id}/appeal`} className="text-muted underline underline-offset-4">
              Something look wrong? Appeal within 72 hours
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard(props: {
  session: { status: string; ended_at: Date | null; price_cents: number };
  baselineDone: boolean;
  postSent: boolean;
  isStudent: boolean;
  isTutorOrPayer: boolean;
  baselineLink: string | null;
  postLink: string | null;
}) {
  const { session } = props;
  const before = !session.ended_at;
  return (
    <Card className="space-y-4">
      {before ? (
        <>
          <p className="font-medium">{props.baselineDone ? 'Warm-up check done' : 'Before the session: a 5-question warm-up check'}</p>
          <p className="text-sm text-ink-soft">
            {props.baselineDone
              ? 'The student’s starting point is recorded. Next: the session itself.'
              : 'It measures where the student starts, so the quiz afterwards can show real progress. Under 5 minutes.'}
          </p>
          {props.baselineLink && <QuizLink path={props.baselineLink} label="Take the warm-up" own={props.isStudent} />}
        </>
      ) : (
        <>
          <p className="font-medium">{props.postSent ? 'Post-session quiz sent' : 'Writing the post-session quiz…'}</p>
          <p className="text-sm text-ink-soft">
            {props.postSent
              ? 'Results show up here as soon as it’s done.'
              : 'It’s built from what was actually covered. Usually a few minutes after the tutor confirms the topics.'}
          </p>
          {props.postLink && <QuizLink path={props.postLink} label="Take the quiz" own={props.isStudent} />}
        </>
      )}
      <p className="text-sm text-muted">
        Session price <Money cents={session.price_cents} />
      </p>
    </Card>
  );
}

function QuizLink({ path, label, own }: { path: string; label: string; own: boolean }) {
  if (own) return <ButtonLink href={path} variant="gain">{label}</ButtonLink>;
  return (
    <p className="text-sm text-ink-soft">
      Send the student this link:{' '}
      <Link href={path} className="break-all font-medium text-ink underline underline-offset-4">
        {path.split('?')[0]}
      </Link>
    </p>
  );
}
