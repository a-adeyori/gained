'use client';

// One question per screen, a progress bar, and quick friendly feedback. Quizzes never run past
// 5 minutes: when time is up, whatever is answered is submitted.

import { useEffect, useRef, useState, useTransition } from 'react';
import { MathText } from '@/components/math-text';
import { Button, ButtonLink, Card, inputClass } from '@/components/ui';
import type { PublicQuestion } from '@/lib/quiz-access';
import { answerQuestion, finishQuiz, type Feedback } from './actions';

const TIME_LIMIT_MS = 5 * 60_000;
const CHEERS = ['Nice!', 'Got it!', 'Exactly.', 'That’s it.', 'Spot on.'];

type Props = {
  quizId: string;
  sessionId: string;
  token: string | undefined;
  kind: 'baseline' | 'post' | 'retention';
  title: string;
  intro: string;
  subject: string;
  tutorName: string;
  questions: PublicQuestion[];
  answered: number;
};

export function QuizRunner(props: Props) {
  const { questions } = props;
  const [stage, setStage] = useState<'intro' | 'question' | 'done'>(props.answered ? 'question' : 'intro');
  const [index, setIndex] = useState(Math.min(props.answered, questions.length - 1));
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // A resumed quiz skips the intro, so its clock starts on load.
  const [deadline, setDeadline] = useState<number | null>(() => (props.answered ? Date.now() + TIME_LIMIT_MS : null));
  const [remaining, setRemaining] = useState(TIME_LIMIT_MS);
  const finishedRef = useRef(false);
  const writtenRef = useRef<HTMLTextAreaElement>(null);
  const keys = keysFor(props.subject);

  const question = questions[index];
  const progress = ((index + (feedback ? 1 : 0)) / questions.length) * 100;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    startTransition(async () => {
      const result = await finishQuiz(props.quizId, props.token);
      if (result.ok) setStage('done');
      else {
        finishedRef.current = false;
        setError(result.message ?? 'Couldn’t submit. Try again.');
      }
    });
  };

  // The 5-minute clock starts at the first question and also runs across a resumed quiz.
  useEffect(() => {
    if (stage !== 'question' || deadline === null) return;
    const timer = setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        finish();
      }
    }, 500);
    return () => clearInterval(timer);
    // finish is stable enough for this purpose; re-running on every render would reset the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, deadline]);

  const begin = () => {
    setDeadline(Date.now() + TIME_LIMIT_MS);
    setStage('question');
  };

  const submit = (value: string) => {
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await answerQuestion(props.quizId, props.token, index, value);
      if (result.kind === 'error') {
        setError(result.message);
        return;
      }
      if (result.kind === 'graded' && result.correct) setCorrectCount((n) => n + 1);
      setFeedback(result);
    });
  };

  const next = () => {
    setFeedback(null);
    setAnswer('');
    if (index + 1 >= questions.length) finish();
    else setIndex(index + 1);
  };

  if (stage === 'intro') {
    return (
      <div className="pt-8">
        <p className="text-sm font-medium text-muted">
          {props.subject} · with {props.tutorName}
        </p>
        <h1 className="mt-1 font-display text-5xl leading-tight tracking-tight">{props.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{props.intro}</p>
        <Card className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="num text-3xl font-semibold">{questions.length}</p>
            <p className="text-sm text-muted">questions</p>
          </div>
          <div>
            <p className="num text-3xl font-semibold">&lt; 5</p>
            <p className="text-sm text-muted">minutes</p>
          </div>
        </Card>
        <Button onClick={begin} className="mt-8 w-full min-h-14 text-lg">
          Start
        </Button>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="pt-16 text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-gain-soft text-4xl text-gain-ink" aria-hidden>
          ✓
        </div>
        <h1 className="mt-6 font-display text-5xl tracking-tight">All done</h1>
        <p className="mt-3 text-lg text-ink-soft">
          {props.kind === 'baseline'
            ? 'Thanks! Now go learn something. You’ll see how far you came after the session.'
            : correctCount > 0
              ? `${correctCount} right on the spot. Your full result is on the session page in a minute.`
              : 'Thanks for finishing. Your result is on the session page in a minute.'}
        </p>
        {/* A link, not an automatic redirect, so nobody is moved on mid-read. A signed-out
            student (the quiz needs no sign-in) is sent to sign in, then lands on Home. */}
        <ButtonLink
          href={props.kind === 'baseline' ? '/home' : `/sessions/${props.sessionId}`}
          className="mt-8 w-full min-h-14 text-lg"
        >
          {props.kind === 'baseline' ? 'Back to home' : 'See your result'}
        </ButtonLink>
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60_000);
  const seconds = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0');

  return (
    <div className="pt-4">
      <div className="flex items-center gap-3">
        <div
          className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={index + (feedback ? 1 : 0)}
          aria-label="Quiz progress"
        >
          <div className="h-full rounded-full bg-gain transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className={`num text-sm ${remaining < 60_000 ? 'text-state-awaiting' : 'text-muted'}`}>
          {deadline ? `${minutes}:${seconds}` : ''}
        </span>
      </div>
      <p className="mt-6 text-sm font-medium text-muted">
        Question {index + 1} of {questions.length}
      </p>

      <h1 className="mt-2 text-2xl font-medium leading-snug">
        <MathText text={question.prompt} />
      </h1>

      <div className="mt-6 space-y-3">
        {question.type === 'multiple_choice' &&
          question.choices.map((choice, i) => {
            const picked = answer === String(i);
            return (
              <button
                key={i}
                type="button"
                disabled={pending || !!feedback}
                onClick={() => {
                  setAnswer(String(i));
                  submit(String(i));
                }}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[17px] transition ${
                  picked
                    ? feedback?.kind === 'graded'
                      ? feedback.correct
                        ? 'border-gain bg-gain-soft'
                        : 'border-state-appeal'
                      : 'border-ink'
                    : 'border-line bg-card hover:border-line-strong'
                }`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line-strong text-sm font-semibold">
                  {String.fromCharCode(65 + i)}
                </span>
                <MathText text={choice} />
              </button>
            );
          })}

        {question.type !== 'multiple_choice' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(answer);
            }}
            className="space-y-3"
          >
            {question.type === 'numeric' ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  inputMode="decimal"
                  autoComplete="off"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={pending || !!feedback}
                  placeholder="Your answer"
                  aria-label="Your answer"
                  className={`${inputClass} min-h-14 text-xl`}
                />
                {question.unit && <span className="text-lg text-muted">{question.unit}</span>}
              </div>
            ) : (
              <div className="space-y-2">
                <SymbolBar keys={keys} target={writtenRef} onInsert={setAnswer} disabled={pending || !!feedback} />
                <textarea
                  ref={writtenRef}
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={pending || !!feedback}
                  rows={5}
                  placeholder="Show your reasoning"
                  aria-label="Your answer"
                  className={`${inputClass} py-3`}
                />
              </div>
            )}
            {!feedback && (
              <Button type="submit" disabled={pending || !answer.trim()} className="w-full min-h-14 text-lg">
                Check
              </Button>
            )}
          </form>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-state-appeal">
          {error}
        </p>
      )}

      {feedback && feedback.kind !== 'error' && (
        <div
          role="status"
          className={`mt-6 rounded-2xl p-4 ${
            feedback.kind === 'graded' ? (feedback.correct ? 'bg-gain-soft' : 'bg-surface-2') : 'bg-surface-2'
          }`}
        >
          <p className={`font-semibold ${feedback.kind === 'graded' && feedback.correct ? 'text-gain-ink' : ''}`}>
            {feedback.kind === 'saved'
              ? props.kind === 'baseline'
                ? 'Saved.'
                : 'Saved. This one is graded when you finish.'
              : feedback.correct
                ? CHEERS[index % CHEERS.length]
                : 'Not quite.'}
          </p>
          {feedback.kind === 'graded' && (
            <p className="mt-1 text-ink-soft">
              <MathText text={feedback.explanation} />
            </p>
          )}
          <Button onClick={next} disabled={pending} className="mt-4 w-full min-h-12">
            {index + 1 >= questions.length ? 'Finish' : 'Next'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Symbols a keyboard doesn't have, for written answers, chosen by the session's subject (tutors
// type subjects freely, so they're matched by keyword). The grader reads these and plain-text
// forms (x^2, sqrt(49), +/-) alike, so the buttons are a convenience, not a requirement.
type Key = { symbol: string; label?: string };

const MATH: Key[] = [
  { symbol: '²', label: 'squared' },
  { symbol: '³', label: 'cubed' },
  { symbol: '√', label: 'square root' },
  { symbol: '±', label: 'plus or minus' },
  { symbol: 'π', label: 'pi' },
  { symbol: '×', label: 'times' },
  { symbol: '÷', label: 'divided by' },
  { symbol: '≤', label: 'less than or equal to' },
  { symbol: '≥', label: 'greater than or equal to' },
  { symbol: '≠', label: 'not equal to' },
  { symbol: '°', label: 'degrees' },
];
const TRIG: Key[] = [
  { symbol: 'sin' },
  { symbol: 'cos' },
  { symbol: 'tan' },
  { symbol: 'θ', label: 'theta' },
  { symbol: '⁴', label: 'to the fourth' },
  { symbol: 'ⁿ', label: 'to the n' },
  { symbol: '∛', label: 'cube root' },
];
const CHEMISTRY: Key[] = [
  { symbol: '→', label: 'reaction arrow' },
  { symbol: '⇌', label: 'equilibrium arrow' },
  { symbol: '₂', label: 'subscript 2' },
  { symbol: '₃', label: 'subscript 3' },
  { symbol: '₄', label: 'subscript 4' },
  { symbol: 'Δ', label: 'delta' },
  { symbol: '°', label: 'degrees' },
  { symbol: '×', label: 'times' },
];
const letters = (s: string): Key[] => [...s].map((symbol) => ({ symbol }));

const KEY_SETS: [RegExp, Key[]][] = [
  [/chem/, CHEMISTRY],
  [/trig|calc|physics|geometry|math|sat\b|act\b|engineering/, [...MATH, ...TRIG]],
  [/algebra|statistic|econ/, MATH],
  [/spanish|español/, letters('áéíóúñü¿¡')],
  [/french|français/, letters('àâçéèêëîïôùûœ')],
  [/german|deutsch/, letters('äöüß')],
  [/italian|portuguese/, letters('àèéìòùãõâêôç')],
];

/** The buttons for a subject, or none for subjects that don't need them (history, essays). */
function keysFor(subject: string): Key[] {
  const s = subject.toLowerCase();
  return KEY_SETS.find(([match]) => match.test(s))?.[1] ?? [];
}

/** Inserts a symbol at the cursor in `target`, then puts the cursor just after it. */
function SymbolBar({
  keys,
  target,
  onInsert,
  disabled,
}: {
  keys: Key[];
  target: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (value: string) => void;
  disabled: boolean;
}) {
  const insert = (symbol: string) => {
    const el = target.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    onInsert(el.value.slice(0, start) + symbol + el.value.slice(end));
    // After React re-renders the new value, restore focus and place the cursor after the symbol.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + symbol.length, start + symbol.length);
    });
  };
  if (!keys.length) return null;
  return (
    <div role="toolbar" aria-label="Symbols" className="flex flex-wrap gap-1.5">
      {keys.map(({ symbol, label }) => (
        <button
          key={symbol}
          type="button"
          disabled={disabled}
          aria-label={`Insert ${label ?? symbol}`}
          title={label ?? symbol}
          // Keep the textarea focused (and the phone keyboard open) while tapping a symbol.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert(symbol)}
          className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-line bg-card px-2 text-lg hover:bg-surface-2 disabled:opacity-40"
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
