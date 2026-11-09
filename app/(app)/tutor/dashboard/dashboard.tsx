'use client';

// The tutor dashboard: one AG Studio instance over the tutor's own data (./studio/data.ts), opening
// on the default report (./studio/initial-report.ts) or the layout the tutor saved in this browser.
// The assistant is attached only when the server says both the AG Studio licence and the
// Anthropic key are configured; otherwise the dashboard works without it.

import { useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import {
  AgStudioAiModule,
  enableStudioDevValidations,
  type AgReportState,
  type AgStudioApi,
  type AgStudioMode,
} from 'ag-studio';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import { cx } from '@/components/ui';
import { buildAi } from './studio/ai';
import { buildStudioData } from './studio/data';
import { tutorReport } from './studio/initial-report';
import { gainedStudioTheme } from './studio/theme';

if (process.env.NODE_ENV !== 'production') {
  enableStudioDevValidations();
}

type DashboardProps = {
  licenseKey?: string;
  /** Whether the AI assistant can run: an AG Studio licence and Elastic (ELASTIC_URL, ELASTIC_API_KEY) are both set. */
  aiEnabled: boolean;
  /** First and last session dates, 'YYYY-MM-DD'. */
  from: string;
  to: string;
};

// Bump the version when the report's fields change, so an old saved layout isn't loaded.
const STORAGE_KEY = 'gained.tutor-dashboard.v1';

function readSaved(): AgReportState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AgReportState) : null;
  } catch {
    return null;
  }
}

function writeSaved(state: AgReportState | null) {
  try {
    if (state) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows and blocked storage: the layout just isn't remembered.
  }
}

// The filters panel is the only panel in view mode, so it starts open there; in edit mode
// Compose and Data need the room.
const withFiltersPanelFor = (mode: AgStudioMode, state: AgReportState): AgReportState => ({
  ...state,
  panels: { ...state.panels, filters: { ...state.panels?.filters, collapsed: mode === 'edit' } },
});

const noSubscription = () => () => {};

export function TutorDashboard(props: DashboardProps) {
  // Studio and the saved layout only exist in the browser.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return inBrowser ? <Studio {...props} /> : <DashboardSkeleton />;
}

function Studio({ licenseKey, aiEnabled, from, to }: DashboardProps) {
  const apiRef = useRef<AgStudioApi | null>(null);
  const [mode, setMode] = useState<AgStudioMode>('view');
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Studio reads these once, when it is created.
  const [initialState] = useState(() => withFiltersPanelFor('view', readSaved() ?? tutorReport));
  const data = useMemo(() => buildStudioData({ from, to }), [from, to]);
  const ai = useMemo(() => (aiEnabled ? buildAi() : undefined), [aiEnabled]);

  const changeMode = (next: AgStudioMode) => {
    const api = apiRef.current;
    if (api) api.setState(withFiltersPanelFor(next, api.getState()));
    setMode(next);
  };
  const save = () => {
    const api = apiRef.current;
    if (!api) return;
    writeSaved(api.getState());
    setSavedAt(Date.now());
    changeMode('view');
  };
  const reset = () => {
    const api = apiRef.current;
    if (!api) return;
    writeSaved(null);
    api.setState(withFiltersPanelFor('view', tutorReport));
    api.clearHistory();
    setSavedAt(null);
    setMode('view');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          {aiEnabled
            ? 'Ask the assistant about your sessions, or edit the layout.'
            : 'The AI assistant is off here: it needs an AG Studio licence and an Anthropic API key on the server.'}
        </p>
        <div className="flex items-center gap-1">
          {savedAt && mode === 'view' && <span className="px-2 text-muted">Layout saved</span>}
          {mode === 'edit' ? (
            <>
              <ToolbarButton onClick={reset}>Reset to default</ToolbarButton>
              <ToolbarButton onClick={() => changeMode('view')}>Done</ToolbarButton>
              <ToolbarButton onClick={save} primary>
                Save layout
              </ToolbarButton>
            </>
          ) : (
            <ToolbarButton onClick={() => changeMode('edit')} disabled={!ready}>
              Edit layout
            </ToolbarButton>
          )}
        </div>
      </div>

      <div className="h-[calc(100dvh-13rem)] min-h-[640px] overflow-hidden rounded-xl">
        <AgStudioProvider licenseKey={licenseKey} modules={ai ? [AgStudioAiModule] : undefined}>
          <AgStudio
            style={{ height: '100%', width: '100%' }}
            theme={gainedStudioTheme}
            layout={{ widgetBorderEnabled: true }}
            data={data}
            ai={ai}
            initialState={initialState}
            mode={mode}
            onApiReady={(event) => {
              apiRef.current = event.api;
            }}
            onStudioReady={() => setReady(true)}
          />
        </AgStudioProvider>
      </div>
    </div>
  );
}

function ToolbarButton({
  primary,
  className,
  ...props
}: ComponentProps<'button'> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-8 items-center rounded-full px-3 font-medium transition disabled:opacity-50',
        primary ? 'bg-ink text-surface hover:opacity-90' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}

function DashboardSkeleton() {
  const block = 'animate-pulse rounded-xl border border-line bg-card';
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="h-8" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cx(block, 'h-24')} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[7fr_5fr]">
        <div className={cx(block, 'h-72')} />
        <div className={cx(block, 'h-72')} />
      </div>
      <div className={cx(block, 'h-64')} />
    </div>
  );
}
