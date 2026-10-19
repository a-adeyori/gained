'use client';

// Tutor availability view: drag across the "Open time" row to add a range, tap a range to
// select it, and see booked sessions (read-only) on the row below. Client-only; load it through ./index.

import { BryntumScheduler } from '@bryntum/scheduler-react';
import { useMemo } from 'react';
import './theme';
import { baseSchedulerProps, OPEN_COLOR, sessionColor, type CalendarRange, type CalendarSession } from './types';

const OPEN_ROW = 'open';
const BOOKED_ROW = 'booked';

export type AvailabilitySchedulerProps = {
  ranges: CalendarRange[];
  sessions: CalendarSession[];
  selectedId: string | null;
  /** Saves a new range; resolves to an error message, or null once it's saved. */
  onCreate: (start: Date, end: Date) => Promise<string | null>;
  onSelectRange: (id: string | null) => void;
  onSessionClick: (session: CalendarSession) => void;
};

export default function AvailabilityScheduler({ ranges, sessions, selectedId, onCreate, onSelectRange, onSessionClick }: AvailabilitySchedulerProps) {
  const base = useMemo(() => baseSchedulerProps(new Date()), []);

  const resources = useMemo(
    () => [
      { id: OPEN_ROW, name: 'Open time' },
      { id: BOOKED_ROW, name: 'Booked' },
    ],
    [],
  );
  const columns = useMemo(() => [{ text: '', field: 'name', width: 110 }], []);

  const events = useMemo(
    () => [
      ...ranges.map((r) => ({
        id: r.id,
        resourceId: OPEN_ROW,
        startDate: r.start,
        endDate: r.end,
        name: r.id === selectedId ? 'Selected' : 'Open',
        eventColor: OPEN_COLOR,
        ...(r.id === selectedId ? {} : { eventStyle: 'dashed' as const }),
        draggable: false,
        resizable: false,
      })),
      ...sessions.map((s) => ({
        id: s.id,
        resourceId: BOOKED_ROW,
        startDate: s.start,
        endDate: s.end,
        name: s.label,
        eventColor: sessionColor(s),
        readOnly: true,
        draggable: false,
        resizable: false,
      })),
    ],
    [ranges, sessions, selectedId],
  );
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const rangeIds = useMemo(() => new Set(ranges.map((r) => r.id)), [ranges]);

  return (
    <BryntumScheduler
      {...base}
      columns={columns}
      resources={resources}
      events={events}
      eventDragCreateFeature
      emptyText=""
      onBeforeDragCreate={({ resourceRecord }) => resourceRecord.id === OPEN_ROW}
      onBeforeDragCreateFinalize={({ context }) => {
        // Hold the drag open until the server answers. The temporary bar is always dropped;
        // the saved range comes back through props once the page refreshes.
        context.async = true;
        void onCreate(context.startDate, context.endDate).finally(() => context.finalize(false));
      }}
      onEventClick={({ eventRecord }) => {
        const id = String(eventRecord.id);
        if (rangeIds.has(id)) onSelectRange(id === selectedId ? null : id);
        const session = sessionById.get(id);
        if (session) onSessionClick(session);
      }}
      onScheduleClick={() => onSelectRange(null)}
    />
  );
}
