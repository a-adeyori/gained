'use client';

// The tutor's calendar: drag to add open time, tap to select and remove it, or use the
// simple form (easier on a phone). Booked sessions show below, coloured by escrow state.

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AvailabilityScheduler, type CalendarRange, type CalendarSession } from '@/components/scheduler';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { addAvailability, removeAvailability } from './actions';

const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Half-hour options from 7:00 to 22:00 (the hours the calendar shows), as "HH:MM" local time.
const TIMES = Array.from({ length: 31 }, (_, i) => `${pad(7 + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);
const timeOption = (hhmm: string) => timeLabel(new Date(`2000-01-01T${hhmm}`));

export default function AvailabilityBoard({ ranges, sessions }: { ranges: CalendarRange[]; sessions: CalendarSession[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [today] = useState(() => isoDay(new Date()));

  const selected = ranges.find((r) => r.id === selectedId) ?? null;

  async function create(start: Date, end: Date): Promise<string | null> {
    const result = await addAvailability(start.toISOString(), end.toISOString());
    if (result?.error) {
      setMessage({ text: result.error, error: true });
      return result.error;
    }
    setMessage({ text: `Added ${dayLabel(start)}, ${timeLabel(start)}–${timeLabel(end)}.` });
    return null;
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeAvailability(id);
      if (result?.error) setMessage({ text: result.error, error: true });
      else {
        setMessage({ text: 'Removed.' });
        setSelectedId(null);
      }
    });
  }

  function submitForm(form: FormData) {
    const day = String(form.get('day') ?? '');
    const start = new Date(`${day}T${form.get('from')}`);
    const end = new Date(`${day}T${form.get('to')}`);
    startTransition(async () => {
      await create(start, end);
    });
  }

  return (
    <div className="space-y-6">
      <div className="gained-scheduler h-[300px]">
        <AvailabilityScheduler
          ranges={ranges}
          sessions={sessions}
          selectedId={selectedId}
          onCreate={create}
          onSelectRange={setSelectedId}
          onSessionClick={(s) => s.href && router.push(s.href)}
        />
      </div>

      {message && (
        <p role={message.error ? 'alert' : 'status'} className={message.error ? 'text-sm text-state-appeal' : 'text-sm text-ink-soft'}>
          {message.text}
        </p>
      )}

      {selected && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">{dayLabel(new Date(selected.start))}</span>{' '}
            <span className="text-ink-soft">
              {timeLabel(new Date(selected.start))}–{timeLabel(new Date(selected.end))}
            </span>
          </p>
          <div className="flex gap-2">
            <Button variant="danger" disabled={pending} onClick={() => remove(selected.id)}>
              Remove this block
            </Button>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Keep
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">Add a block</h2>
          <form action={submitForm} className="space-y-4">
            <Field label="Day">
              <input name="day" type="date" required min={today} defaultValue={today} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <select name="from" defaultValue="16:00" className={inputClass}>
                  {TIMES.map((t) => (
                    <option key={t} value={t}>
                      {timeOption(t)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="To">
                <select name="to" defaultValue="19:00" className={inputClass}>
                  {TIMES.map((t) => (
                    <option key={t} value={t}>
                      {timeOption(t)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add block'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Your open blocks</h2>
          {ranges.length ? (
            <ul className="divide-y divide-line">
              {ranges.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm">
                    <span className="font-medium">{dayLabel(new Date(r.start))}</span>{' '}
                    <span className="text-ink-soft">
                      {timeLabel(new Date(r.start))}–{timeLabel(new Date(r.end))}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                    className="min-h-11 rounded-full px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing yet. Add a block so families can book you.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
