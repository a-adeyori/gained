'use client';

// PRD screen 4, for the tutor: start the session, write what was taught, end it, then the one
// follow-up action: confirm the topics. Sessions aren't recorded: the post-session quiz is
// written from the tutor's summary, turned into a topic list the tutor reviews before confirming.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Card, Field, inputClass, PageTitle } from '@/components/ui';
import type { TopicList } from '@/lib/claude';

type Stage = 'before' | 'live' | 'ending' | 'processing' | 'topics' | 'done';

/** Matches the end route's limit. */
const MAX_NOTES_LENGTH = 2000;

type Props = {
  sessionId: string;
  studentName: string;
  subject: string;
  plannedTopics: string;
  meetingPlace: string | null;
  startAt: string;
  initialStage: 'before' | 'processing';
  initialTopics: TopicList | null;
};

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

export function LiveSession(props: Props) {
  const { sessionId } = props;
  const [stage, setStage] = useState<Stage>(props.initialTopics ? 'topics' : props.initialStage);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicList | null>(props.initialTopics);
  const [quizPath, setQuizPath] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  // The session clock ticks once a second while the session is live.
  useEffect(() => {
    if (stage !== 'live' || startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stage, startedAt]);

  const begin = async () => {
    setError(null);
    try {
      await post(`/api/sessions/${sessionId}/start`);
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
      setStage('live');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const end = async () => {
    setError(null);
    setStage('ending');
    try {
      await post(`/api/sessions/${sessionId}/end`, { notes });
      setStage('processing');
    } catch (err) {
      setStage('live');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // While the pipeline runs: poll until the topic list (then the quiz) is ready.
  const poll = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/status`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { topics: TopicList | null; topicsConfirmed: boolean; postQuizPath: string | null; error: string | null };
    setPipelineError(data.error);
    if (data.postQuizPath) setQuizPath(data.postQuizPath);
    if (data.topics && !data.topicsConfirmed) {
      setTopics((t) => t ?? data.topics);
      setStage((s) => (s === 'processing' ? 'topics' : s));
    }
  }, [sessionId]);

  useEffect(() => {
    if (stage !== 'processing' && stage !== 'done') return;
    if (stage === 'done' && quizPath) return;
    const first = setTimeout(poll, 0);
    const timer = setInterval(poll, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [stage, quizPath, poll]);

  const confirmTopics = async () => {
    setError(null);
    try {
      await post(`/api/sessions/${sessionId}/topics`, { topics: topics?.topics });
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow={`${props.subject} · ${props.studentName}`} title={TITLES[stage]}>
        {stage === 'before' && (
          <>
            Planned: {props.plannedTopics}
            <br />
            <span className="text-sm text-muted">
              Starts {new Date(props.startAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {props.meetingPlace && <> · {props.meetingPlace}</>}
            </span>
          </>
        )}
      </PageTitle>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-state-appeal px-4 py-3 text-sm text-state-appeal">
          {error}
        </p>
      )}

      {stage === 'before' && (
        <Card className="space-y-4">
          <p className="text-sm text-ink-soft">
            When you end the session, you’ll write what you taught {props.studentName}: the subtopics, or a short summary. The quiz
            after the session is written from it. Sessions aren’t recorded.
          </p>
          <Button onClick={begin} className="w-full">
            Start session
          </Button>
        </Card>
      )}

      {(stage === 'live' || stage === 'ending') && (
        <div className="space-y-4">
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="size-3 animate-pulse rounded-full bg-state-base" aria-hidden />
              <p className="font-medium">Session in progress</p>
            </div>
            <span className="num text-2xl font-semibold tracking-tight">{clock(startedAt === null ? 0 : now - startedAt)}</span>
          </Card>

          <Card>
            <Field
              label={`What did you teach ${props.studentName}?`}
              hint="The subtopics you covered or a short summary, including any problems you worked through. The quiz is written from this, so be specific. You can fill it in as you go."
            >
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_NOTES_LENGTH}
                rows={6}
                placeholder={'e.g.\n- Newton’s second law, F = ma\n- Drawing free-body diagrams\n- Worked: a 10 kg sled pulled with 50 N against 20 N friction'}
                className={`${inputClass} py-2.5`}
              />
            </Field>
          </Card>

          <Button onClick={end} disabled={stage === 'ending' || !notes.trim()} className="w-full">
            {stage === 'ending' ? 'Ending…' : 'End session'}
          </Button>
          {!notes.trim() && <p className="text-center text-sm text-muted">Write what you taught to end the session.</p>}
        </div>
      )}

      {stage === 'processing' && (
        <Card className="space-y-2">
          <p className="font-medium">Working out what you covered…</p>
          <p className="text-sm text-muted">
            Turning your summary into a list of topics for you to check. This usually takes under a minute. You can leave this
            page; the topics will be waiting on the session page.
          </p>
          {pipelineError && <p className="text-sm text-state-awaiting">{pipelineError}. Using your summary as the topics instead.</p>}
        </Card>
      )}

      {stage === 'topics' && topics && (
        <div className="space-y-4">
          <p className="text-ink-soft">This is what the quiz will test. Fix anything that’s off, then confirm.</p>
          <Card className="space-y-3">
            {topics.topics.map((topic, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Topic ${i + 1}`}
                  value={topic.name}
                  onChange={(e) =>
                    setTopics({ ...topics, topics: topics.topics.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)) })
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  aria-label={`Remove ${topic.name}`}
                  onClick={() => setTopics({ ...topics, topics: topics.topics.filter((_, j) => j !== i) })}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTopics({ ...topics, topics: [...topics.topics, { name: '', skills: [], problem_types: [] }] })}
              className="text-sm font-medium text-ink-soft underline underline-offset-4"
            >
              Add a topic
            </button>
          </Card>
          <Button onClick={confirmTopics} className="w-full">
            Confirm topics
          </Button>
        </div>
      )}

      {stage === 'done' && (
        <Card className="space-y-4">
          <p className="text-ink-soft">
            Thanks. The quiz is being written now and goes to {props.studentName} as soon as it’s checked. The 80% base is paid once
            the family confirms the session happened (or automatically after 24 hours).
          </p>
          {quizPath ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Quiz link for {props.studentName}</p>
              <CopyLink path={quizPath} />
            </div>
          ) : (
            <p className="text-sm text-muted">The quiz link appears here in about a minute.</p>
          )}
          <ButtonLink href={`/sessions/${sessionId}`} variant="secondary" className="w-full">
            View session
          </ButtonLink>
        </Card>
      )}

      {stage !== 'done' && stage !== 'before' && stage !== 'live' && stage !== 'ending' && (
        <p className="mt-6 text-center text-sm">
          <Link href="/home" className="text-muted underline underline-offset-4">
            Back to sessions
          </Link>
        </p>
      )}
    </div>
  );
}

const TITLES: Record<Stage, string> = {
  before: 'Ready when you are',
  live: 'Session in progress',
  ending: 'Wrapping up',
  processing: 'Session ended',
  topics: 'Confirm what you covered',
  done: 'All set',
};

function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
  return (
    <div className="flex gap-2">
      <input ref={ref} readOnly value={url} className={`${inputClass} text-sm`} onFocus={(e) => e.target.select()} />
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => ref.current?.select());
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
