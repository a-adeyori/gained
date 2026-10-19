'use client';

// PRD screen 4, for the tutor: start/stop recording, add photos of worked problems, fallback
// bullet notes, end the session. After it ends, the one follow-up action: confirm the topics.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Card, Field, inputClass, PageTitle } from '@/components/ui';
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
  consentRecording: boolean;
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

/** Resize a photo to at most 1600px on its long side as JPEG, so uploads stay small. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read photo'))), 'image/jpeg', 0.82));
}

export function LiveSession(props: Props) {
  const { sessionId } = props;
  const [stage, setStage] = useState<Stage>(props.initialTopics ? 'topics' : props.initialStage);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicList | null>(props.initialTopics);
  const [quizPath, setQuizPath] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const recorder = useRecorder(`/api/sessions/${sessionId}/audio`);

  // Bullets are required when there's no usable recording.
  const needsNotes = !props.consentRecording || recorder.state === 'failed' || recorder.uploadFailed;

  const begin = async () => {
    setError(null);
    try {
      await post(`/api/sessions/${sessionId}/start`);
      setStage('live');
      if (props.consentRecording) await recorder.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const end = async () => {
    setError(null);
    if (needsNotes && !notes.trim()) {
      setError('Add 3–5 bullet points on what you covered, so the quiz matches the session.');
      return;
    }
    setStage('ending');
    try {
      await recorder.stop();
      await post(`/api/sessions/${sessionId}/end`, { notes });
      setStage('processing');
    } catch (err) {
      setStage('live');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const blob = await shrink(file);
        const res = await fetch(`/api/sessions/${sessionId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'The photo didn’t upload.');
        setPhotos(data.count);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhotoBusy(false);
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
          {props.consentRecording ? (
            <p className="text-sm text-ink-soft">
              <strong className="text-ink">Recording is on for this session.</strong> Tell {props.studentName} before you start
              {props.studentIsMinor ? ' (their parent has consented)' : ''}. Audio is used only to write the quiz and is deleted
              right after it’s transcribed.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">
              Recording was declined for this session. At the end, add 3–5 bullet points and photos of worked problems; the quiz
              is built from those.
            </p>
          )}
          <Button onClick={begin} className="w-full" disabled={recorder.state === 'requesting'}>
            {props.consentRecording ? 'Start session and recording' : 'Start session'}
          </Button>
        </Card>
      )}

      {(stage === 'live' || stage === 'ending') && (
        <div className="space-y-4">
          {props.consentRecording && (
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
          )}

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Photos of worked problems</p>
              <span className="num text-sm text-muted">{photos} added</span>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line-strong px-5 text-[15px] font-medium hover:bg-surface-2">
              {photoBusy ? 'Uploading…' : 'Add photos'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                disabled={photoBusy}
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </Card>

          <Card>
            <Field
              label={needsNotes ? 'What you covered (required)' : 'Notes (optional)'}
              hint="3–5 bullet points, one per line. The quiz is built from these if there's no recording."
            >
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder={'- Solving two-step linear equations\n- Distributing negatives\n- Word problems with rates'}
                className={`${inputClass} min-h-32 py-3`}
              />
            </Field>
          </Card>

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
            Transcribing and reading your photos. This usually takes a minute or two. You can leave this page; the topics will be
            waiting on the session page.
          </p>
          {pipelineError && <p className="text-sm text-state-awaiting">{pipelineError}. Using your notes instead.</p>}
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
