'use client';

// Loads the availability board in the browser only: it shows times in the tutor's own time
// zone and hosts the Bryntum calendar, neither of which can render on the server.

import dynamic from 'next/dynamic';

export const AvailabilityBoardLoader = dynamic(() => import('./availability-board'), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-2xl border border-line bg-card" />,
});
