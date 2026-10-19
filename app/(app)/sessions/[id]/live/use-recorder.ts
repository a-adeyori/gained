'use client';

// Browser audio recording for a live session. 32 kbps keeps an hour near 14 MB, under
// OpenAI's 25 MB limit; the recorder restarts every 60 minutes so each file stays small, and
// every finished file uploads in the background (retried a few times before giving up).

import { useCallback, useEffect, useRef, useState } from 'react';

const ROTATE_MS = 60 * 60 * 1000;
const BITRATE = 32_000;

function pickMimeType(): string | undefined {
  // Chrome records webm, Safari mp4; both are accepted for transcription.
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'failed';

export function useRecorder(uploadUrl: string) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [uploadsPending, setUploadsPending] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rotateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const uploadsRef = useRef<Promise<void>[]>([]);
  const stoppingRef = useRef(false);
  // The recorder restarts itself on rotation, so it reaches its own start function via a ref.
  const startRecorderRef = useRef<() => void>(() => {});

  const upload = useCallback(
    async (blob: Blob) => {
      if (!blob.size) return;
      setUploadsPending((n) => n + 1);
      try {
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const res = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': blob.type.split(';')[0] || 'audio/webm' },
              body: blob,
            });
            if (res.ok) return;
            if (res.status < 500) throw new Error((await res.json().catch(() => null))?.error ?? `Upload failed (${res.status})`);
          } catch (err) {
            if (attempt === 4) throw err;
          }
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      } catch (err) {
        setUploadFailed(true);
        setError(err instanceof Error ? err.message : 'The recording didn’t upload.');
      } finally {
        setUploadsPending((n) => n - 1);
      }
    },
    [uploadUrl],
  );

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITRATE });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      uploadsRef.current.push(upload(blob));
      // Rotation: start the next file straight away unless the tutor is ending the session.
      if (!stoppingRef.current) startRecorderRef.current();
    };
    recorder.onerror = () => {
      setState('failed');
      setError('Recording stopped unexpectedly.');
    };
    // A timeslice keeps data flowing so a crash loses at most a few seconds.
    recorder.start(10_000);
    recorderRef.current = recorder;
    rotateRef.current = setTimeout(() => recorder.state === 'recording' && recorder.stop(), ROTATE_MS);
  }, [upload]);

  useEffect(() => {
    startRecorderRef.current = startRecorder;
  }, [startRecorder]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('failed');
      setError('This browser can’t record audio. Try Chrome or Safari.');
      return;
    }
    setState('requesting');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setState('failed');
      setError('Microphone access was blocked. Allow it in your browser settings.');
      return;
    }
    stoppingRef.current = false;
    startedAtRef.current = Date.now();
    startRecorder();
    setState('recording');
  }, [startRecorder]);

  /** Stops recording and resolves once every file has uploaded (or failed). */
  const stop = useCallback(async () => {
    stoppingRef.current = true;
    if (rotateRef.current) clearTimeout(rotateRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState((s) => (s === 'failed' ? s : 'stopped'));
    await Promise.all(uploadsRef.current);
  }, []);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);
    return () => clearInterval(timer);
  }, [state]);

  // Release the microphone if the tutor navigates away mid-session.
  useEffect(
    () => () => {
      if (rotateRef.current) clearTimeout(rotateRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { state, error, elapsedMs, uploadsPending, uploadFailed, start, stop };
}
