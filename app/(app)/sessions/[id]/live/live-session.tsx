'use client';

// PRD screen 4, for the tutor: start the session (and its recording), end it, then the one
// follow-up action: confirm the topics. The quiz comes from the transcript; if the microphone
// fails, from the topics planned at booking, which the tutor reviews before confirming.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Card, inputClass, PageTitle } from '@/components/ui';
import type { TopicList } from '@/lib/claude';
import { useRecorder } from './use-recorder';

type Stage = 'before' | 'live' | 'ending' | 'processing' | 'topics' | 'done';

type Props = {
  sessionId: string;
  studentName: string;
  studentIsMinor: boolean;
  subject: string;
  plannedTopics: string;
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
  const recorder = useRecorder(`/api/sessions/${sessionId}/audio`);

  // If the microphone fails, the quiz falls back to the topics planned at booking.
  const recordingProblem = recorder.state === 'failed' || recorder.uploadFailed;

  const begin = async () => {
    setError(null);
    try {
      await post(`/api/sessions/${sessionId}/start`);
      setStage('live');
      await recorder.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const end = async () => {
    setError(null);
    setStage('ending');
    try {
      await recorder.stop();
      await post(`/api/sessions/${sessionId}/end`, {});
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
            <strong className="text-ink">The session’s audio is recorded.</strong> Let {props.studentName} know before you start
            {props.studentIsMinor ? ' (their parent has agreed)' : ''}. When you end the session it’s turned into a transcript and
            the audio is deleted immediately. The quiz is written from the transcript.
          </p>
          <Button onClick={begin} className="w-full" disabled={recorder.state === 'requesting'}>
            Start session and recording
          </Button>
        </Card>
      )}

      {(stage === 'live' || stage === 'ending') && (
        <div className="space-y-4">
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`size-3 rounded-full ${recorder.state === 'recording' ? 'animate-pulse bg-state-appeal' : 'bg-state-held'}`}
                aria-hidden
              />
              <div>
                <p className="font-medium">
                  {recorder.state === 'recording'
                    ? 'Recording'
                    : recorder.state === 'requesting'
                      ? 'Waiting for the microphone…'
                      : recorder.state === 'failed'
                        ? 'Not recording'
                        : 'Recording stopped'}
                </p>
                {recorder.error && <p className="text-sm text-state-appeal">{recorder.error}</p>}
              </div>
            </div>
            <span className="num text-2xl font-semibold tracking-tight">{clock(recorder.elapsedMs)}</span>
          </Card>

          {recordingProblem && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
              The recording isn’t working, so the quiz will be based on the topics planned at booking. You’ll review them before the
              quiz is written.
            </p>
          )}

          <Button onClick={end} disabled={stage === 'ending'} className="w-full">
            {stage === 'ending'
              ? recorder.uploadsPending
                ? 'Uploading the recording…'
                : 'Ending…'
              : 'End session'}
          </Button>
        </div>
      )}

      {stage === 'processing' && (
        <Card className="space-y-2">
          <p className="font-medium">Working out what you covered…</p>
          <p className="text-sm text-muted">
            Turning the audio into a transcript, then deleting the audio. This usually takes a minute or two. You can leave this
            page; the topics will be waiting on the session page.
          </p>
          {pipelineError && <p className="text-sm text-state-awaiting">{pipelineError}. Using the planned topics instead.</p>}
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
