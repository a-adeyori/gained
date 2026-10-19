// AG Studio theme for the tutor dashboard. UI colours point at the Gained tokens in
// app/globals.css, so Studio follows light and dark mode with the rest of the app. The chart
// palette is fixed to plain colours: gain green first (single-series charts are learning gains or
// earned money), then the escrow state colours in the order of STATE_COLUMNS in lib/studio-data.ts,
// so the six "sessions by escrow state" series always wear their own state's colour.

import { studioTheme } from 'ag-studio';
import { ESCROW_STATE_HEX } from '@/lib/escrow-states';

const token = (name: string) => `var(--${name})`;
const line = (color: string) => ({ width: 1, color: token(color) });

const FONT = 'var(--font-inter), system-ui, sans-serif';

const PALETTE = [
  ESCROW_STATE_HEX.settled, // also gain green
  ESCROW_STATE_HEX.base_paid,
  ESCROW_STATE_HEX.awaiting_retention,
  ESCROW_STATE_HEX.returned,
  ESCROW_STATE_HEX.held,
  ESCROW_STATE_HEX.in_appeal,
  '#5fb7a0',
  '#a3a093',
  '#e0a96d',
  '#6f6b62',
];

const palette = Object.fromEntries(
  PALETTE.flatMap((color, i) => [
    [`chartPaletteFills${i + 1}Color`, color],
    [`chartPaletteStrokes${i + 1}Color`, color],
  ]),
);

export const gainedStudioTheme = studioTheme.withParams({
  browserColorScheme: 'inherit',
  fontFamily: FONT,
  fontSize: 13,
  textColor: token('ink'),
  foregroundColor: token('ink'),
  subtleTextColor: token('muted'),
  backgroundColor: token('card'),
  borderColor: token('line'),
  accentColor: token('focus'),
  iconColor: token('ink-soft'),
  rowHoverColor: token('surface-2'),

  // No frame: the canvas is the page itself, and widgets are the app's cards.
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: token('surface'),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: token('surface'),
  studioCanvasPadding: 0,
  studioCanvasRowHeight: 16,
  studioCanvasFontFamily: FONT,

  studioWidgetBackgroundColor: token('card'),
  studioWidgetBorder: line('line'),
  studioWidgetBorderRadius: 12,
  studioWidgetPadding: 12,
  studioWidgetTitleFontFamily: FONT,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: token('ink'),
  studioWidgetSubtitleFontFamily: FONT,
  studioWidgetSubtitleFontSize: 12,
  studioWidgetSubtitleTextColor: token('muted'),
  studioWidgetCaptionFontFamily: FONT,
  studioWidgetCaptionFontSize: 12,
  studioWidgetCaptionTextColor: token('muted'),
  studioWidgetResizeBorderColor: token('focus'),

  studioPanelContainerBackgroundColor: token('card'),
  studioPanelContainerBorder: line('line'),
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: token('line'),
  studioPanelDividerActiveColor: token('focus'),
  studioPanelSectionBorderColor: token('line'),
  studioPanelHeaderFontFamily: FONT,
  studioPanelHeaderFontWeight: 600,
  studioPanelChevronButtonHoverBackgroundColor: token('surface-2'),
  studioPanelChevronButtonHoverColor: token('ink'),
  studioToggleButtonActiveBackgroundColor: token('surface-2'),
  studioToggleButtonActiveBorderColor: token('line-strong'),
  studioToggleButtonActiveColor: token('ink'),

  // Dense, Linear-style tables: small muted headers, hairline rows, 32px rows.
  gridFontFamily: FONT,
  gridFontSize: 13,
  gridCellTextColor: token('ink'),
  gridHeaderBackgroundColor: token('card'),
  gridHeaderTextColor: token('muted'),
  gridHeaderFontWeight: 500,
  gridHeaderFontSize: 12,
  gridRowHeight: 32,
  gridRowBorder: line('line'),
  gridHeaderRowBorder: line('line'),
  gridPinnedRowBorder: line('line'),
  gridRowHoverColor: token('surface-2'),
  gridWrapperBorder: false,

  chartFontFamily: FONT,
  chartTextColor: token('ink'),
  chartSubtleTextColor: token('muted'),
  chartAxisLineColor: token('line'),
  chartGridLineColor: token('line'),
  ...palette,
});
