// Server proxy for the dashboard assistant's Claude adapter (app/(app)/tutor/dashboard/studio/
// claude-adapter.ts). The adapter runs in the browser and sends Messages API content (system,
// messages, tools, optional JSON output format); this route checks the caller is a signed-in
// tutor, fixes the model and limits, adds ANTHROPIC_API_KEY, and streams the SDK's events back
// as newline-delimited JSON. The key never leaves the server and the client can't pick a model.

import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaJSONOutputFormat,
  BetaMessageParam,
  BetaTool,
  BetaMessageStreamParams,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';

const MODEL = 'claude-opus-5-5';
// Bounds one turn's cost whatever the client sends. Streaming, so a high cap doesn't time out.
const MAX_TOKENS = 32_000;
const MAX_BODY_BYTES = 2_000_000;

const BETAS = [
  // Classifier refusals are retried server-side on Anthropic's recommended model for the category.
  'server-side-fallback-2026-07-01',
  // Studio rebuilds its instructions and tool list from live dashboard state each turn, which
  // invalidates earlier thinking blocks; drop those instead of failing the request.
  'thinking-binding-controls-2026-08-01',
  // Notes between tool calls come back as short readable thinking, shown as the assistant's reasoning.
  'thinking-display-updates-2026-08-18',
];

// Only the content block types a dashboard conversation produces. In particular no server tools
// (web search, code execution, MCP): tools must be plain client tools that Studio runs itself.
const Block = z
  .object({
    type: z.enum(['text', 'image', 'document', 'thinking', 'redacted_thinking', 'tool_use', 'tool_result']),
  })
  .passthrough();

const Body = z.object({
  system: z.string().max(400_000).optional(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.union([z.string(), z.array(Block)]) }))
    .min(1),
  tools: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        description: z.string().max(20_000).optional(),
        input_schema: z.object({ type: z.literal('object') }).passthrough(),
      }),
    )
    .max(128)
    .optional(),
  tool_choice: z.enum(['auto', 'none']).optional(),
  output_format: z
    .object({ type: z.literal('json_schema'), schema: z.record(z.string(), z.unknown()) })
    .optional(),
});

const error = (status: number, message: string) => Response.json({ error: { message } }, { status });

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return error(401, 'Sign in to use the assistant.');
  if (user.role !== 'tutor') return error(403, 'The assistant is for tutors.');
  if (!process.env.ANTHROPIC_API_KEY) return error(503, 'The assistant is not configured: set ANTHROPIC_API_KEY.');

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, 'The conversation is too long. Start a new one.');
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(JSON.parse(raw));
  } catch {
    return error(400, 'Malformed assistant request.');
  }

  const params: BetaMessageStreamParams = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: BETAS,
    fallbacks: 'default',
    // Thinking can't be turned off on Opus 5.5; effort is the depth control. Dashboard edits are
    // multi-step tool use, so medium (stated explicitly, it's also this model's default).
    thinking: { type: 'adaptive', display: 'updates', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
    output_config: {
      effort: 'medium',
      ...(parsed.output_format && { format: parsed.output_format as BetaJSONOutputFormat }),
    },
    // Studio's system prompt and tool list are large and repeat every turn.
    cache_control: { type: 'ephemeral' },
    ...(parsed.system && { system: parsed.system }),
    messages: parsed.messages as BetaMessageParam[],
    ...(parsed.tools?.length && { tools: parsed.tools as BetaTool[] }),
    ...(parsed.tool_choice && parsed.tools?.length && { tool_choice: { type: parsed.tool_choice } }),
  };

  // Stopping the chat in Studio aborts the browser request, which cancels this one too.
  const stream = anthropic().beta.messages.stream(params, { signal: request.signal });
  const encoder = new TextEncoder();
  const line = (value: unknown) => encoder.encode(JSON.stringify(value) + '\n');

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) controller.enqueue(line(event));
      } catch (err) {
        // Headers are already sent, so a failure mid-stream travels as a final error line.
        if (!request.signal.aborted) {
          const message = err instanceof Anthropic.APIError ? err.message : 'The assistant failed to respond.';
          if (!(err instanceof Anthropic.APIError)) console.error('[studio-ai]', err);
          controller.enqueue(line({ type: 'error', error: { message } }));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
