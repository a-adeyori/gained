// Server proxy for the dashboard assistant's Claude adapter (app/(app)/tutor/dashboard/studio/
// claude-adapter.ts). The adapter runs in the browser and sends Messages API content (system,
// messages, tools, optional JSON output format); this route checks the caller is a signed-in
// tutor, runs the turn on Claude through Elastic's connector (lib/elastic.ts, converted by
// lib/studio-elastic.ts), and sends the reply back as newline-delimited Messages API stream
// events. The key never leaves the server and the client can't pick a model. The connector
// replies whole, so the events arrive together rather than word by word.

import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { chat, elasticConfigured } from '@/lib/elastic';
import { toChatRequest, toStreamEvents, type StudioRequest } from '@/lib/studio-elastic';

const MAX_BODY_BYTES = 2_000_000;

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

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return error(401, 'Sign in to use the assistant.');
  if (user.role !== 'tutor') return error(403, 'The assistant is for tutors.');
  if (!elasticConfigured()) return error(503, 'The assistant is not configured: set ELASTIC_URL and ELASTIC_API_KEY.');

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, 'The conversation is too long. Start a new one.');
  let parsed: StudioRequest;
  try {
    parsed = Body.parse(JSON.parse(raw)) as StudioRequest;
  } catch {
    return error(400, 'Malformed assistant request.');
  }

  let events: Record<string, unknown>[];
  try {
    // Stopping the chat in Studio aborts the browser request, which cancels this one too.
    const reply = await chat(toChatRequest(parsed), { signal: request.signal });
    events = toStreamEvents(reply, { jsonOutput: Boolean(parsed.output_format) });
  } catch (err) {
    if (request.signal.aborted) return error(499, 'Stopped.');
    console.error('[studio-ai]', err);
    // The connector marks even rejected requests as retryable, so the message doesn't promise more.
    return error(502, 'The assistant failed to respond. Try again.');
  }

  const body = events.map((event) => JSON.stringify(event)).join('\n') + '\n';
  return new Response(body, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
