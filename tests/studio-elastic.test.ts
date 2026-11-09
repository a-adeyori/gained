import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSON_TOOL, toChatRequest, toStreamEvents, type StudioRequest } from '../lib/studio-elastic';

const tool = { name: 'set_filter', description: 'Filter the grid', input_schema: { type: 'object', properties: { subject: { type: 'string' } } } };

test('a conversation with tool use becomes OpenAI-style chat, tool results first', () => {
  const request: StudioRequest = {
    system: 'You edit the dashboard.',
    messages: [
      { role: 'user', content: 'Only show math.' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'secret', signature: 'x' },
          { type: 'text', text: 'Filtering.' },
          { type: 'tool_use', id: 'call_1', name: 'set_filter', input: { subject: 'Math' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Thanks' },
          { type: 'tool_result', tool_use_id: 'call_1', content: [{ type: 'text', text: 'done' }] },
        ],
      },
    ],
    tools: [tool],
  };
  const chat = toChatRequest(request);
  assert.deepEqual(chat.messages, [
    { role: 'system', content: 'You edit the dashboard.' },
    { role: 'user', content: 'Only show math.' },
    {
      role: 'assistant',
      content: 'Filtering.',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'set_filter', arguments: '{"subject":"Math"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_1', content: 'done' },
    { role: 'user', content: 'Thanks' },
  ]);
  assert.equal(chat.tool_choice, 'auto');
  assert.deepEqual(chat.tools?.[0], { type: 'function', function: { name: 'set_filter', description: 'Filter the grid', parameters: tool.input_schema } });
});

test('a tool-only assistant turn has no content field, and failed tools and images are described in text', () => {
  const chat = toChatRequest({
    messages: [
      { role: 'assistant', content: [{ type: 'tool_use', id: 'c', name: 'set_filter', input: {} }] },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'c', content: 'Cancelled before it ran.', is_error: true },
          { type: 'image', source: {} },
        ],
      },
    ],
  });
  assert.equal(chat.messages[0].role, 'assistant');
  assert.equal('content' in chat.messages[0], false);
  assert.deepEqual(chat.messages[1], { role: 'tool', tool_call_id: 'c', content: 'Error: Cancelled before it ran.' });
  assert.match((chat.messages[2] as { content: string }).content, /attached a image|can’t read|can't read/);
  assert.equal(chat.tools, undefined);
});

test('a JSON-output request is answered through a forced tool, and comes back as text', () => {
  const schema = { type: 'object', properties: { title: { type: 'string' } } };
  const chat = toChatRequest({ messages: [{ role: 'user', content: 'Name this thread' }], tools: [tool], output_format: { type: 'json_schema', schema } });
  assert.equal(chat.tools?.length, 1);
  assert.equal(chat.tools?.[0].function.name, JSON_TOOL);
  assert.deepEqual(chat.tool_choice, { type: 'function', function: { name: JSON_TOOL } });

  const events = toStreamEvents(
    { content: null, toolCalls: [{ id: 't', type: 'function', function: { name: JSON_TOOL, arguments: '{"title":"Math"}' } }], usage: { promptTokens: 5, completionTokens: 2 } },
    { jsonOutput: true },
  );
  const deltas = events.filter((e) => e.type === 'content_block_delta');
  assert.deepEqual(deltas, [{ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"title":"Math"}' } }]);
  assert.deepEqual(events.at(-2), { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } });
});

test('a reply with text and tool calls becomes a text block then tool_use blocks', () => {
  const events = toStreamEvents(
    {
      id: 'msg_1',
      model: 'gp-llm-v2',
      content: 'Filtering now.',
      toolCalls: [{ id: 'call_9', type: 'function', function: { name: 'set_filter', arguments: '{"subject":"Math"}' } }],
      usage: { promptTokens: 10, completionTokens: 4 },
    },
    { jsonOutput: false },
  );
  assert.deepEqual(
    events.map((e) => e.type),
    [
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop',
    ],
  );
  assert.deepEqual(events[4], { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'call_9', name: 'set_filter', input: {} } });
  assert.deepEqual(events[5], { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"subject":"Math"}' } });
  assert.equal((events[7].delta as { stop_reason: string }).stop_reason, 'tool_use');
});
