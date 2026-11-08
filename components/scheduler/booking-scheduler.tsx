'use client';

// Parent booking view: tutors are rows, their open time shows as shaded ranges, and booked
// sessions are bars coloured by escrow state. Client-only; load it through ./index.

import type { Model } from '@bryntum/core-enterprise';
import { BryntumScheduler } from '@bryntum/scheduler-react-enterprise';
import { useMemo } from 'react';
import { formatUsd } from '@/lib/escrow-states';
import './license';
import './theme';
import { baseSchedulerProps, OPEN_COLOR, sessionColor, type CalendarRange, type CalendarSession, type CalendarTutor } from './types';

export type BookingSchedulerProps = {
  tutors: CalendarTutor[];
  ranges: CalendarRange[];
  sessions: CalendarSession[];
  /** Fired for a click anywhere on a tutor's row; the caller decides if it's open time. */
  onSlotClick: (tutorId: string, date: Date) => void;
  onSessionClick: (session: CalendarSession) => void;
};

export default function BookingScheduler({ tutors, ranges, sessions, onSlotClick, onSessionClick }: BookingSchedulerProps) {
  // Base config is fixed for the life of the component so Bryntum isn't reconfigured on every render.
  const base = useMemo(() => baseSchedulerProps(new Date()), []);

  const resources = useMemo(
    () => tutors.map((t) => ({ id: t.id, name: t.name, subjects: t.subjects.join(', '), price: `${formatUsd(t.priceCents)}/hr` })),
    [tutors],
  );
  const resourceTimeRanges = useMemo(
    () => ranges.map((r) => ({ id: r.id, resourceId: r.tutorId, startDate: r.start, endDate: r.end, name: 'Open', timeRangeColor: OPEN_COLOR })),
    [ranges],
  );
  const events = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        resourceId: s.tutorId,
        startDate: s.start,
        endDate: s.end,
        name: s.label,
        eventColor: sessionColor(s),
        // Unapproved holds and appeals are outlined rather than filled.
        ...(s.state === null || s.state === 'in_appeal' ? { eventStyle: 'dashed' as const } : {}),
        readOnly: true,
        draggable: false,
        resizable: false,
      })),
    [sessions],
  );
  const columns = useMemo(
    () => [
      {
        text: 'Tutor',
        field: 'name',
        width: 150,
        renderer: ({ record }: { record: Model }) => ({
          children: [
            { tag: 'div', style: { fontWeight: '600' }, text: String(record.getData('name')) },
            { tag: 'div', style: { fontSize: '0.85em', opacity: '0.7' }, text: String(record.getData('subjects')) },
            { tag: 'div', style: { fontSize: '0.85em', fontVariantNumeric: 'tabular-nums' }, text: String(record.getData('price')) },
          ],
        }),
      },
    ],
    [],
  );
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  return (
    <BryntumScheduler
      {...base}
      columns={columns}
      resources={resources}
      events={events}
      resourceTimeRanges={resourceTimeRanges}
      // Pointer events pass through the ranges so a click lands on the schedule underneath.
      resourceTimeRangesFeature={{ enableMouseEvents: false }}
      emptyText="No tutors have open time yet."
      onScheduleClick={({ resourceRecord, date }) => onSlotClick(String(resourceRecord.id), date)}
      onEventClick={({ eventRecord }) => {
        const session = byId.get(String(eventRecord.id));
        if (session) onSessionClick(session);
      }}
    />
  );
}
