// A real voice from the pilot (Loom-style). Renders only when the clip has actually been added
// to public/, so the page never shows a placeholder or a staged testimonial.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { DeviceFrame } from './device-frame';

const publicFile = (name: string) => existsSync(path.join(process.cwd(), 'public', name));

export function VoiceClip() {
  if (!publicFile('pilot-voice.mp4')) return null;
  const hasCaptions = publicFile('pilot-voice.vtt');
  const hasPoster = publicFile('pilot-voice.jpg');

  return (
    <section aria-labelledby="voice-title" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="text-sm font-medium text-muted">From the pilot</p>
          <h2 id="voice-title" className="mt-2 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            In their own words.
          </h2>
          <p className="mt-4 leading-relaxed text-ink-soft">Thirty unscripted seconds from a family in the pilot.</p>
        </div>
        <DeviceFrame title="Pilot voice · 30 seconds">
          <video
            controls
            playsInline
            preload="metadata"
            poster={hasPoster ? '/pilot-voice.jpg' : undefined}
            className="aspect-video w-full rounded-xl bg-surface-2"
          >
            <source src="/pilot-voice.mp4" type="video/mp4" />
            {hasCaptions && <track kind="captions" src="/pilot-voice.vtt" srcLang="en" label="English" default />}
          </video>
        </DeviceFrame>
      </div>
    </section>
  );
}
