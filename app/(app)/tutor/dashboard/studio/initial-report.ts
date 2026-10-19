// The default tutor dashboard as AG Studio report state: earnings KPIs, earnings over time,
// average gain by topic, sessions by escrow state, and a dense sessions table. Field ids
// ('earnings.netEarnings') refer to the tables in ./data.ts.

import type { AgPageState, AgReportState, AgWidgetLayoutState } from 'ag-studio';
import { STATE_COLUMNS } from '@/lib/studio-data';

// Position on the canvas grid, in tracks: 24 columns wide, rows of studioCanvasRowHeight.
const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({
  xTrack,
  yTrack,
  xSpan,
  ySpan,
});
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: 'sum' as const });
const avg = (id: string) => ({ id, aggregation: 'avg' as const });
const countd = (id: string) => ({ id, aggregation: 'countd' as const });
const legend = { theme: { common: { legend: { enabled: true } } } };

const kpi = (text: string, value: { id: string; aggregation: 'sum' | 'avg' | 'countd' }, sparkline = true) => ({
  type: 'value' as const,
  dataMapping: { value: [value], ...(sparkline && { sparklineX: [{ id: 'calendar::month' }] }) },
  format: {
    title: { enabled: true, text, typography: { fontSize: 13, fontWeight: 'normal' as const } },
    caption: { enabled: false, text: '' },
    style: { typography: { fontSize: 24, fontWeight: 'bold' as const } },
  },
});

const overview: AgPageState = {
  id: 'overview',
  widgets: {
    'kpi-net': kpi('Net earnings, after fees', sum('earnings.netEarnings')),
    'kpi-bonus': kpi('Learning bonus earned', sum('earnings.bonusCaptured')),
    'kpi-gain': kpi('Average learning gain', avg('sessions.quizGain')),
    'kpi-sessions': kpi('Sessions', countd('sessions.sessionId')),
    // Bonus first so it takes the palette's gain green; the base takes Base paid blue.
    earnings: {
      type: 'column-chart-stacked',
      dataMapping: {
        categoryKey: [{ id: 'calendar::month' }],
        valueKey: [sum('earnings.bonusCaptured'), sum('earnings.baseCaptured')],
      },
      format: { ...title('Earnings by month, before fees'), style: legend },
    },
    'gain-by-topic': {
      type: 'bar-chart-grouped',
      dataMapping: {
        categoryKey: [{ id: 'topicGains.topic' }],
        valueKey: [avg('topicGains.quizGain')],
      },
      sort: [{ field: avg('topicGains.quizGain'), direction: 'desc' }],
      format: title('Average learning gain by topic'),
    },
    // One series per state, in STATE_COLUMNS order, so each takes its state's palette colour.
    'by-state': {
      type: 'column-chart-stacked',
      dataMapping: {
        categoryKey: [{ id: 'calendar::month' }],
        valueKey: Object.values(STATE_COLUMNS).map((column) => sum(`sessions.${column}`)),
      },
      format: { ...title('Sessions by escrow state'), style: legend },
    },
    sessions: {
      type: 'grid',
      dataMapping: {
        cols: [
          { id: 'sessions.startTime' },
          { id: 'sessions.student' },
          { id: 'sessions.subject' },
          { id: 'sessions.durationMinutes' },
          { id: 'sessions.price' },
          { id: 'sessions.escrowState' },
          { id: 'sessions.preScore' },
          { id: 'sessions.postScore' },
          { id: 'sessions.retentionScore' },
          { id: 'sessions.quizGain' },
          { id: 'sessions.retentionGain' },
          { id: 'sessions.tutorPay' },
        ],
      },
      sort: [{ field: { id: 'sessions.startTime' }, direction: 'desc' }],
      format: title('Sessions'),
    },
  },
  widgetLayout: {
    'kpi-net': at(0, 0, 6, 7),
    'kpi-bonus': at(6, 0, 6, 7),
    'kpi-gain': at(12, 0, 6, 7),
    'kpi-sessions': at(18, 0, 6, 7),
    earnings: at(0, 7, 14, 18),
    'gain-by-topic': at(14, 7, 10, 18),
    'by-state': at(0, 25, 24, 15),
    sessions: at(0, 40, 24, 26),
  },
};

export const tutorReport: AgReportState = {
  selectedPageId: overview.id,
  pages: [overview],
};
