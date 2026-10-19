'use client';

// Tracks the pointer inside the element as --mx / --my, for spotlight hovers on the bento tiles.

import type { ReactNode } from 'react';

export function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
    >
      {children}
    </div>
  );
}
