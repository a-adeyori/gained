// Runs the tutor dashboard assistant on Elastic. The browser adapter
// (app/(app)/tutor/dashboard/studio/claude-adapter.ts) speaks Claude's Messages API: it sends
// system, messages, tools and an optional JSON output format, and reads back Messages API stream
// events. Elastic's connector speaks OpenAI-style chat (lib/elastic.ts) and replies whole. These
// pure functions convert the request one way and the reply back into the events the adapter
// already understands, so the browser side doesn't change. Tested in tests/studio-elastic.test.ts.

import type { ChatMessage, ChatReply, ChatRequest, ChatTool, ChatToolCall } from './elastic';

type Block = { type: string; [key: string]: unknown };
export type StudioMessage = { role: 'user' | 'assistant'; content: string | Block[] };
export type StudioRequest = {
  system?: string;
  messages: StudioMessage[];
  tools?: { name: string; description?: string; input_schema: Record<string, unknown> }[];
  tool_choice?: 'auto' | 'none';
  output_format?: { type: 'json_schema'; schema: Record<string, unknown> };
};

/** The tool a JSON-output request is answered through: the connector has no JSON mode. */
export const JSON_TOOL = 'respond';

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** A tool result's content (a string, or text and image blocks) as plain text. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((b: Block) => (b.type === 'text' ? text(b.text) : `[${b.type} omitted: the assistant reads text only]`))
    .join('\n');
}

function userMessages(content: StudioMessage['content']): ChatMessage[] {
  if (typeof content === 'string') return [{ role: 'user', content }];
  // Tool results answer the previous assistant turn, so they come first, one message each.
  const results: ChatMessage[] = content
    .filter((b) => b.type === 'tool_result')
    .map((b) => ({
      role: 'tool',
      tool_call_id: text(b.tool_use_id),
      content: (b.is_error ? 'Error: ' : '') + (resultText(b.content) || '(empty)'),
    }));
  const parts = content.flatMap((b) => {
    if (b.type === 'text') return text(b.text) ? [text(b.text)] : [];
    if (b.type === 'image' || b.type === 'document') return [`[The tutor attached a ${b.type === 'image' ? 'image' : 'file'}, which the assistant can't read.]`];
    return [];
  });
  return parts.length ? [...results, { role: 'user', content: parts.join('\n\n') }] : results;
}

function assistantMessage(content: StudioMessage['content']): ChatMessage[] {
  if (typeof content === 'string') return content ? [{ role: 'assistant', content }] : [];
  const said = content.flatMap((b) => (b.type === 'text' && text(b.text) ? [text(b.text)] : [])).join('\n\n');
  const calls: ChatToolCall[] = content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: text(b.id), type: 'function', function: { name: text(b.name), arguments: JSON.stringify(b.input ?? {}) } }));
  // Thinking blocks are Claude-specific and the connector can't replay them, so they're dropped.
  if (!said && !calls.length) return [];
  // The connector rejects `content: null`, so a tool-only turn leaves it out.
  return [{ role: 'assistant', ...(said && { content: said }), ...(calls.length && { tool_calls: calls }) }];
}

/** The assistant's request, as a chat request for Elastic's connector. */
export function toChatRequest(request: StudioRequest): ChatRequest {
  const messages: ChatMessage[] = [];
  if (request.system) messages.push({ role: 'system', content: request.system });
  for (const m of request.messages) messages.push(...(m.role === 'user' ? userMessages(m.content) : assistantMessage(m.content)));

  if (request.output_format) {
    // Answer through a forced tool whose parameters are the schema; its arguments are the JSON.
    return {
      messages,
      tools: [{ type: 'function', function: { name: JSON_TOOL, description: 'Give your answer as JSON matching this schema.', parameters: request.output_format.schema } }],
      tool_choice: { type: 'function', function: { name: JSON_TOOL } },
    };
  }
  const tools: ChatTool[] = (request.tools ?? []).map((t) => ({
    type: 'function',
    function: { name: t.name, ...(t.description && { description: t.description }), parameters: t.input_schema },
  }));
  return { messages, ...(tools.length && { tools, tool_choice: request.tool_choice ?? 'auto' }) };
}

/**
 * The connector's whole reply, as the Messages API stream events the browser adapter reads: one
 * text block, then one tool_use block per tool call. A JSON-output reply becomes a text block
 * holding the forced tool's arguments.
 */
export function toStreamEvents(reply: ChatReply, opts: { jsonOutput: boolean }): Record<string, unknown>[] {
  const id = reply.id ?? `msg_elastic_${Date.now()}`;
  const events: Record<string, unknown>[] = [
    { type: 'message_start', message: { id, model: reply.model ?? 'claude-sonnet-4-5 (Elastic)', usage: { input_tokens: reply.usage.promptTokens } } },
  ];
  let index = 0;
  const textBlock = (value: string) => {
    events.push(
      { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index, delta: { type: 'text_delta', text: value } },
      { type: 'content_block_stop', index },
    );
    index++;
  };

  let usedTools = false;
  if (opts.jsonOutput) {
    const answer = reply.toolCalls.find((c) => c.function.name === JSON_TOOL)?.function.arguments ?? reply.content ?? '';
    if (answer) textBlock(answer);
  } else {
    if (reply.content) textBlock(reply.content);
    for (const call of reply.toolCalls) {
      events.push(
        { type: 'content_block_start', index, content_block: { type: 'tool_use', id: call.id, name: call.function.name, input: {} } },
        { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: call.function.arguments || '{}' } },
        { type: 'content_block_stop', index },
      );
      index++;
      usedTools = true;
    }
  }

  events.push(
    { type: 'message_delta', delta: { stop_reason: usedTools ? 'tool_use' : 'end_turn' }, usage: { output_tokens: reply.usage.completionTokens } },
    { type: 'message_stop' },
  );
  return events;
}
