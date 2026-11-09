// Plain, serializable shapes the server pages hand to the schedulers, plus shared config.

import type { BryntumSchedulerProps } from '@bryntum/scheduler-react-enterprise';
import { ESCROW_STATE_HEX, type EscrowStateKey } from '@/lib/escrow-states';

import type { MeetingService } from '@/lib/meeting';

/** `meeting` is the service the tutor's link is on; the link itself is shown once booked. */
export type CalendarTutor = { id: string; name: string; subjects: string[]; priceCents: number; meeting: MeetingService | null };

/** An availability range. Dates are ISO strings. */
export type CalendarRange = { id: string; tutorId: string; start: string; end: string };

export type CalendarSession = {
  id: string;
  tutorId: string;
  start: string;
  end: string;
  /** Null while the parent hasn't approved the hold yet. */
  state: EscrowStateKey | null;
  label: string;
  /** Where clicking the session goes, if the viewer may open it. */
  href?: string;
};

/** Open time is a neutral slate so green stays reserved for gains. */
export const OPEN_COLOR = '#5b7fa6';

export const sessionColor = (s: CalendarSession) => ESCROW_STATE_HEX[s.state ?? 'held'];

const DAY_FROM = 7;
const DAY_TO = 22;

/** Two weeks of daytime hours, snapping to half hours, nothing editable unless enabled. */
export function baseSchedulerProps(start: Date): BryntumSchedulerProps {
  // Open on the current time, or the next morning when it's outside the hours shown.
  const visible = new Date(start);
  if (visible.getHours() >= DAY_TO) visible.setDate(visible.getDate() + 1);
  if (visible.getHours() < DAY_FROM || visible.getHours() >= DAY_TO) visible.setHours(DAY_FROM, 0, 0, 0);
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);
  return {
    startDate,
    endDate,
    viewPreset: 'hourAndDay',
    workingTime: { fromHour: DAY_FROM, toHour: DAY_TO },
    tickSize: 44,
    rowHeight: 64,
    barMargin: 6,
    timeResolution: { unit: 'minute', increment: 30 },
    eventStyle: 'filled',
    eventLayout: 'none',
    autoCreate: false,
    enableDeleteKey: false,
    zoomOnMouseWheel: false,
    zoomOnTimeAxisDoubleClick: false,
    useInitialAnimation: false,
    visibleDate: { date: visible, block: 'start' },
    eventDragFeature: false,
    eventResizeFeature: false,
    eventDragCreateFeature: false,
    eventEditFeature: false,
    eventMenuFeature: false,
    scheduleMenuFeature: false,
    cellMenuFeature: false,
    timeAxisHeaderMenuFeature: false,
    eventDragSelectFeature: false,
  };
}
