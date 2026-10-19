'use client';

// Loads the booking board in the browser only: it shows times in the parent's own time zone
// and hosts the Bryntum calendar, neither of which can render on the server.

import dynamic from 'next/dynamic';

export const BookingBoardLoader = dynamic(() => import('./booking-board'), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl border border-line bg-card sm:h-[520px]" />,
});
