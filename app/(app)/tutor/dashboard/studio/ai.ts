// The AG Studio AI assistant for the tutor dashboard: Studio's built-in agents, running on Claude
// through ./claude-adapter.ts and our proxy at /api/studio-ai, which holds the Anthropic key and
// fixes the model. Nothing secret is in the browser.

import { createAiHarness, type AgAiHarnessSetup, type AgAiPromptStarter } from 'ag-studio';
import { claudeAdapter } from './claude-adapter';

// Suggestions shown in a new conversation, before anything has been typed.
const PROMPT_STARTERS: AgAiPromptStarter[] = [
  {
    label: 'Which topics do my students gain most on?',
    prompt: 'Which topics do my students gain most on? Rank topics by average learning gain and say how many sessions each is based on.',
  },
  {
    label: 'How much did I earn this month after fees?',
    prompt: 'How much did I earn this month after the platform fee? Split it into base and learning bonus, and say how much is still awaiting payout.',
  },
  {
    label: 'Add a chart of gain by student',
    prompt: 'Add a chart to this page showing average learning gain by student.',
  },
];

export function buildAi(): AgAiHarnessSetup {
  const adapter = claudeAdapter({ endpoint: '/api/studio-ai' });
  return ({ api }) => createAiHarness(api, { adapter, promptStarters: PROMPT_STARTERS });
}
