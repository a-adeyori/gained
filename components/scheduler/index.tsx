'use client';

// Client-only entry points for the Bryntum schedulers. Bryntum touches `window` on import,
// so it never renders on the server.

import dynamic from 'next/dynamic';

function SchedulerLoading() {
  return <div className="flex h-full items-center justify-center text-sm text-muted">Loading calendar…</div>;
}

export const BookingScheduler = dynamic(() => import('./booking-scheduler'), { ssr: false, loading: SchedulerLoading });
export const AvailabilityScheduler = dynamic(() => import('./availability-scheduler'), { ssr: false, loading: SchedulerLoading });

export type { BookingSchedulerProps } from './booking-scheduler';
export type { AvailabilitySchedulerProps } from './availability-scheduler';
export * from './types';
