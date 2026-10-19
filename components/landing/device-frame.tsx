// A plain app-window frame, so every section shows the real UI the copy describes (Attio-style).

import type { ReactNode } from 'react';
import { cx } from '@/components/ui';

export function DeviceFrame({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure
      className={cx(
        'overflow-hidden rounded-2xl border border-line-strong bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div className="flex h-10 items-center gap-3 border-b border-line bg-surface-2 px-3.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <figcaption className="min-w-0 flex-1 truncate text-center text-xs text-muted">{title}</figcaption>
        <span className="flex min-w-10 justify-end">{action}</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </figure>
  );
}
