'use client';

// Feeds the pointer position into CSS (--px / --py, roughly -20..20) so the floating equations
// and the product frame drift with it. Writes styles directly; no React re-renders.

import { useRef, type ReactNode } from 'react';

export function HeroStage({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const move = (clientX: number, clientY: number) => {
    const node = ref.current;
    if (!node) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width - 0.5) * 40;
      const y = ((clientY - rect.top) / rect.height - 0.5) * 40;
      node.style.setProperty('--px', x.toFixed(2));
      node.style.setProperty('--py', y.toFixed(2));
    });
  };

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => e.pointerType === 'mouse' && move(e.clientX, e.clientY)}
      onPointerLeave={() => {
        ref.current?.style.setProperty('--px', '0');
        ref.current?.style.setProperty('--py', '0');
      }}
    >
      {children}
    </div>
  );
}
