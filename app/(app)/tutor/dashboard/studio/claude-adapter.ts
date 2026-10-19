// AG Studio LLM adapter for the Claude Messages API, ported from the structure of AG Studio's
// OpenAI example adapter: encode Studio's conversation into Messages API content, stream the
// reply, and translate it into Studio's events and final response. It runs in the browser and
// posts to our proxy (app/api/studio-ai), which holds the key and fixes the model, so the request
// carries no model or limits. The proxy streams the SDK's events as newline-delimited JSON.

import type {
  AgAiConversationItem,
  AgAiEvent,
  AgAiOutputItem,
  AgAiToolSchema,
  AgLlmAdapter,
  AgLlmJsonFormat,
  AgLlmRequest,
  AgLlmResponse,
  AgLlmResponseHandler,
} from 'ag-studio';
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaRawMessageStreamEvent,
  BetaRedactedThinkingBlockParam,
  BetaThinkingBlockParam,
  BetaTool,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';

type JsonSchema = Record<string, unknown>;

/** What the proxy accepts. It adds the model, limits, thinking, effort and betas itself. */
type ProxyBody = {
  system?: string;
  messages: BetaMessageParam[];
  tools?: BetaTool[];
  tool_choice?: 'auto' | 'none';
  output_format?: { type: 'json_schema'; schema: JsonSchema };
};

// =============================================================================
// JSON Schema → what Claude accepts
// =============================================================================
//
// Studio's Shape library emits JSON Schema 2020-12 and marks optional values with a
// `{ not: {} }` ("undefined") branch inside anyOf. Tool input schemas accept general JSON Schema,
// so for tools only those sentinels are removed. Structured output (output_config.format) takes a
// narrower subset: every object needs `additionalProperties: false`, and numeric/string/array
// constraints are not supported, so those are stripped and left to Studio's own validation.

const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUndefinedSentinel = (s: unknown) =>
  isSchema(s) && Object.keys(s).length === 1 && isSchema(s.not) && Object.keys(s.not).length === 0;

const UNSUPPORTED_IN_OUTPUT_FORMAT = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
];

function cleanSchema(schema: JsonSchema, forOutputFormat: boolean): JsonSchema {
  let out: JsonSchema = { ...schema };

  if (Array.isArray(out.anyOf)) {
    const branches = out.anyOf.filter((b) => !isUndefinedSentinel(b));
    const { anyOf: _anyOf, ...rest } = out;
    void _anyOf;
    if (branches.length === 1 && isSchema(branches[0])) out = { ...branches[0], ...rest };
    else out = { ...rest, anyOf: branches };
  }

  if (forOutputFormat) for (const key of UNSUPPORTED_IN_OUTPUT_FORMAT) delete out[key];

  for (const key of ['anyOf', 'allOf', 'oneOf', 'prefixItems']) {
    if (Array.isArray(out[key])) {
      out[key] = (out[key] as unknown[]).map((b) => (isSchema(b) ? cleanSchema(b, forOutputFormat) : b));
    }
  }
  for (const key of ['$defs', 'definitions', 'properties']) {
    const map = out[key];
    if (isSchema(map)) {
      out[key] = Object.fromEntries(
        Object.entries(map).map(([k, v]) => [k, isSchema(v) ? cleanSchema(v, forOutputFormat) : v]),
      );
    }
  }
  if (isSchema(out.items)) out.items = cleanSchema(out.items, forOutputFormat);
  if (isSchema(out.additionalProperties)) {
    out.additionalProperties = forOutputFormat ? false : cleanSchema(out.additionalProperties, false);
  }
  if (forOutputFormat && (out.type === 'object' || isSchema(out.properties))) out.additionalProperties = false;

  return out;
}

// =============================================================================
// Encoding: AG → Claude
// =============================================================================

/**
 * Thinking blocks must be replayed exactly as Claude produced them (text and signature), but
 * Studio's reasoning items only keep an id, a summary and optional text. The adapter keeps the
 * original blocks here, by reasoning item id, for the life of the page. A block that isn't here
 * (after a reload, say) is simply left out; the proxy asks the API to drop rather than reject
 * blocks whose conversation has changed.
 */
type StoredThinking = BetaThinkingBlockParam | BetaRedactedThinkingBlockParam;

function encodeUserContent(item: Extract<AgAiConversationItem, { kind: 'input'; type: 'message' }>): BetaContentBlockParam[] {
  return item.content.flatMap((c): BetaContentBlockParam[] => {
    switch (c.type) {
      case 'text':
        return c.text ? [{ type: 'text', text: c.text }] : [];
      case 'image': {
        const url = c.imageUrl;
        if (!url) return [];
        const data = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/.exec(url);
        if (data) {
          return [{ type: 'image', source: { type: 'base64', media_type: data[1] as 'image/png', data: data[2] } }];
        }
        return [{ type: 'image', source: { type: 'url', url } }];
      }
      case 'file':
        if (c.fileData) {
          return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.fileData } }];
        }
        return c.fileUrl ? [{ type: 'document', source: { type: 'url', url: c.fileUrl } }] : [];
    }
  });
}

function encodeConversation(
  items: AgAiConversationItem[],
  thinking: Map<string, StoredThinking>,
): { messages: BetaMessageParam[]; system: string[] } {
  const messages: BetaMessageParam[] = [];
  const system: string[] = [];

  // Consecutive items of one role become one message: a turn's reasoning, text and tool calls
  // share an assistant message, and every tool result answering them goes in the next user message.
  const push = (role: 'user' | 'assistant', blocks: BetaContentBlockParam[]) => {
    if (!blocks.length) return;
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content)) last.content.push(...blocks);
    else messages.push({ role, content: [...blocks] });
  };

  for (const item of items) {
    if (item.type === 'function_call_output') {
      push('user', [{ type: 'tool_result', tool_use_id: item.callId, content: item.output }]);
    } else if (item.kind === 'input') {
      if (item.role === 'system') {
        system.push(...item.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])));
      } else {
        push('user', encodeUserContent(item));
      }
    } else if (item.type === 'message') {
      push(
        'assistant',
        item.content.flatMap((c) => {
          const text = c.type === 'text' ? c.text : c.refusal;
          return text ? [{ type: 'text' as const, text }] : [];
        }),
      );
    } else if (item.type === 'reasoning') {
      const block = thinking.get(item.id);
      if (block) push('assistant', [block]);
    } else if (item.type === 'function_call') {
      let input: unknown = {};
      try {
        input = item.arguments ? JSON.parse(item.arguments) : {};
      } catch {
        // Unparseable arguments were already reported back to the model as a tool error.
      }
      push('assistant', [{ type: 'tool_use', id: item.callId, name: item.name, input }]);
    }
  }

  return { messages: repairToolPairs(messages), system };
}

/**
 * The API requires every tool_use to be answered by a tool_result at the start of the next user
 * message. A run cancelled mid-tool can leave one unanswered, so those get a cancelled result,
 * and tool results are moved ahead of any other content in their message.
 */
function repairToolPairs(messages: BetaMessageParam[]): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    out.push(message);
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue;
    const callIds = message.content.flatMap((b) => (b.type === 'tool_use' ? [b.id] : []));
    if (!callIds.length) continue;

    let next = messages[i + 1];
    if (next?.role !== 'user' || !Array.isArray(next.content)) {
      next = { role: 'user', content: [] };
      messages.splice(i + 1, 0, next);
    }
    const content = next.content as BetaContentBlockParam[];
    const answered = new Set(content.flatMap((b) => (b.type === 'tool_result' ? [b.tool_use_id] : [])));
    const missing: BetaToolResultBlockParam[] = callIds
      .filter((id) => !answered.has(id))
      .map((id) => ({ type: 'tool_result', tool_use_id: id, content: 'Cancelled before it ran.', is_error: true }));
    const results = [...content.filter((b) => b.type === 'tool_result'), ...missing];
    next.content = [...results, ...content.filter((b) => b.type !== 'tool_result')];
  }
  return out;
}

/**
 * The API rejects tool_use and tool_result blocks in a request that declares no tools, which
 * Studio sends for side tasks such as naming a thread. Those turns get the tool traffic as plain
 * text, and no thinking blocks (their history no longer matches, so they couldn't be replayed).
 */
function withoutToolBlocks(messages: BetaMessageParam[]): BetaMessageParam[] {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    const content = message.content.flatMap((block): BetaContentBlockParam[] => {
      switch (block.type) {
        case 'tool_use':
          return [{ type: 'text', text: `[Called ${block.name} with ${JSON.stringify(block.input)}]` }];
        case 'tool_result': {
          const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
          return [{ type: 'text', text: `[Tool result: ${text}]` }];
        }
        case 'thinking':
        case 'redacted_thinking':
          return [];
        default:
          return [block];
      }
    });
    return { ...message, content: content.length ? content : [{ type: 'text', text: '…' }] };
  });
}

function buildBody(request: AgLlmRequest, thinking: Map<string, StoredThinking>): ProxyBody {
  const encoded = encodeConversation(request.input, thinking);
  const system = encoded.system;
  const instructions = [request.instructions, ...system].filter(Boolean).join('\n\n');
  const tools = (request.tools ?? []).map(
    (tool: AgAiToolSchema): BetaTool => ({
      name: tool.name,
      description: tool.description,
      input_schema: cleanSchema(tool.parameters as unknown as JsonSchema, false) as BetaTool['input_schema'],
    }),
  );
  // Claude Opus 5.5 rejects forced tool use, so 'required' or a named tool becomes 'auto'; Studio's
  // agent instructions already say which tool to call.
  const toolChoice = request.toolChoice === 'none' ? 'none' : 'auto';
  const format = request.responseFormat?.type === 'json' ? (request.responseFormat as AgLlmJsonFormat) : undefined;
  const messages = tools.length ? encoded.messages : withoutToolBlocks(encoded.messages);

  return {
    ...(instructions && { system: instructions }),
    messages,
    ...(tools.length && { tools, tool_choice: toolChoice }),
    ...(format && {
      output_format: { type: 'json_schema', schema: cleanSchema(format.schema as unknown as JsonSchema, true) },
    }),
  };
}

// =============================================================================
// Decoding: Claude stream → AG events and response
// =============================================================================

type OpenBlock =
  | { kind: 'text'; id: string; text: string }
  | { kind: 'thinking'; id: string; thinking: string; signature: string }
  | { kind: 'redacted_thinking'; id: string; data: string }
  | { kind: 'tool_use'; id: string; name: string; json: string }
  | { kind: 'fallback' }
  | { kind: 'other' };

/** Translates one turn's stream events into Studio's events, and collects the final response. */
class StreamTranslator {
  private messageId = '';
  private model?: string;
  private readonly blocks = new Map<number, OpenBlock>();
  private stopReason: string | null = null;
  private inputTokens = 0;
  private outputTokens = 0;
  private cacheRead = 0;
  private cacheWrite = 0;
  error?: Error;

  constructor(private readonly thinking: Map<string, StoredThinking>) {}

  get started() {
    return this.messageId !== '';
  }

  translate(event: BetaRawMessageStreamEvent | { type: 'error'; error?: { message?: string } }): AgAiEvent[] {
    switch (event.type) {
      case 'error':
        this.error ??= new Error(event.error?.message ?? 'The assistant failed to respond.');
        return [];
      case 'message_start':
        this.messageId = event.message.id;
        this.model = event.message.model;
        this.inputTokens = event.message.usage.input_tokens;
        this.cacheRead = event.message.usage.cache_read_input_tokens ?? 0;
        this.cacheWrite = event.message.usage.cache_creation_input_tokens ?? 0;
        return [];
      case 'content_block_start': {
        const id = `${this.messageId}:${event.index}`;
        const block = event.content_block;
        switch (block.type) {
          case 'text':
            this.blocks.set(event.index, { kind: 'text', id, text: block.text });
            return [
              { type: 'TEXT_MESSAGE_START', messageId: id, role: 'assistant' },
              ...(block.text ? [{ type: 'TEXT_MESSAGE_CONTENT' as const, messageId: id, delta: block.text }] : []),
            ];
          case 'thinking':
            this.blocks.set(event.index, { kind: 'thinking', id, thinking: block.thinking, signature: block.signature });
            return [{ type: 'REASONING_MESSAGE_START', messageId: id, role: 'reasoning' }];
          case 'redacted_thinking':
            this.blocks.set(event.index, { kind: 'redacted_thinking', id, data: block.data });
            return [];
          case 'tool_use':
            this.blocks.set(event.index, { kind: 'tool_use', id: block.id, name: block.name, json: '' });
            return [{ type: 'TOOL_CALL_START', toolCallId: block.id, toolCallName: block.name }];
          case 'fallback':
            // A classifier declined and another model took over on the same stream.
            this.blocks.set(event.index, { kind: 'fallback' });
            return [];
          default:
            this.blocks.set(event.index, { kind: 'other' });
            return [];
        }
      }
      case 'content_block_delta': {
        const block = this.blocks.get(event.index);
        const delta = event.delta;
        if (block?.kind === 'text' && delta.type === 'text_delta') {
          block.text += delta.text;
          return [{ type: 'TEXT_MESSAGE_CONTENT', messageId: block.id, delta: delta.text }];
        }
        if (block?.kind === 'thinking' && delta.type === 'thinking_delta') {
          block.thinking += delta.thinking;
          return [{ type: 'REASONING_MESSAGE_CONTENT', messageId: block.id, delta: delta.thinking }];
        }
        if (block?.kind === 'thinking' && delta.type === 'signature_delta') {
          block.signature += delta.signature;
          return [];
        }
        if (block?.kind === 'tool_use' && delta.type === 'input_json_delta') {
          block.json += delta.partial_json;
          return [{ type: 'TOOL_CALL_ARGS', toolCallId: block.id, delta: delta.partial_json }];
        }
        return [];
      }
      case 'content_block_stop': {
        const block = this.blocks.get(event.index);
        if (block?.kind === 'text') return [{ type: 'TEXT_MESSAGE_END', messageId: block.id }];
        if (block?.kind === 'thinking') return [{ type: 'REASONING_MESSAGE_END', messageId: block.id }];
        if (block?.kind === 'tool_use') return [{ type: 'TOOL_CALL_END', toolCallId: block.id }];
        return [];
      }
      case 'message_delta':
        this.stopReason = event.delta.stop_reason ?? this.stopReason;
        this.outputTokens = event.usage.output_tokens ?? this.outputTokens;
        return [];
      default:
        return [];
    }
  }

  /** The turn's final response, once the stream has ended. */
  response(): AgLlmResponse {
    const ordered = [...this.blocks.entries()].sort(([a], [b]) => a - b).map(([, block]) => block);
    // After a mid-stream fallback, reasoning and tool calls from the declined attempt are dropped;
    // its text stays, as the API's echo rules for fallback turns require.
    const boundary = ordered.map((b) => b.kind).lastIndexOf('fallback');
    const truncated = this.stopReason === 'max_tokens';
    const refused = this.stopReason === 'refusal';

    const output: AgAiOutputItem[] = [];
    if (refused) {
      // A partial answer cut off by a refusal isn't trustworthy, so only the refusal is kept.
      output.push({
        id: `${this.messageId}:refusal`,
        kind: 'output',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'refusal', refusal: "Sorry, I can't help with that request. Try rephrasing it." }],
      });
    } else {
      ordered.forEach((block, i) => {
        const beforeFallback = i < boundary;
        switch (block.kind) {
          case 'text':
            if (block.text) {
              output.push({
                id: block.id,
                kind: 'output',
                type: 'message',
                role: 'assistant',
                status: truncated ? 'incomplete' : 'completed',
                content: [{ type: 'text', text: block.text, annotations: [] }],
              });
            }
            break;
          case 'thinking':
          case 'redacted_thinking':
            if (beforeFallback) break;
            this.thinking.set(
              block.id,
              block.kind === 'thinking'
                ? { type: 'thinking', thinking: block.thinking, signature: block.signature }
                : { type: 'redacted_thinking', data: block.data },
            );
            output.push({
              id: block.id,
              kind: 'output',
              type: 'reasoning',
              summary: block.kind === 'thinking' && block.thinking ? [{ type: 'summary', text: block.thinking }] : [],
            });
            break;
          case 'tool_use':
            // A tool input cut off by max_tokens can still look valid, so it is never run.
            if (beforeFallback || truncated) break;
            output.push({
              id: block.id,
              kind: 'output',
              type: 'function_call',
              callId: block.id,
              name: block.name,
              arguments: block.json || '{}',
              status: 'completed',
            });
            break;
        }
      });
    }

    return {
      id: this.messageId,
      createdAt: Date.now(),
      model: this.model,
      status: truncated ? 'incomplete' : 'completed',
      incompleteDetails: truncated ? { reason: 'max_output_tokens' } : undefined,
      output,
      usage: {
        // Studio counts cached tokens as a subset of input; the API reports them separately.
        inputTokens: this.inputTokens + this.cacheRead + this.cacheWrite,
        outputTokens: this.outputTokens,
        totalTokens: this.inputTokens + this.cacheRead + this.cacheWrite + this.outputTokens,
        cachedInputTokens: this.cacheRead,
        cacheWriteTokens: this.cacheWrite,
      },
    };
  }
}

// =============================================================================
// Transport
// =============================================================================

async function* streamTurn(
  endpoint: string,
  body: ProxyBody,
  translator: StreamTranslator,
  signal?: AbortSignal,
): AsyncIterableIterator<AgAiEvent> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const emit = (text: string): AgAiEvent[] => {
    if (!text.trim()) return [];
    try {
      return translator.translate(JSON.parse(text));
    } catch (err) {
      translator.error ??= err instanceof Error ? err : new Error(String(err));
      return [];
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const text of lines) yield* emit(text);
  }
  yield* emit(buffer + decoder.decode());
}

function runTurn(
  endpoint: string,
  thinking: Map<string, StoredThinking>,
  request: AgLlmRequest,
  signal?: AbortSignal,
): AgLlmResponseHandler {
  const translator = new StreamTranslator(thinking);
  const events = streamTurn(endpoint, buildBody(request, thinking), translator, signal);

  let resolveComplete!: (response: AgLlmResponse) => void;
  let rejectComplete!: (error: Error) => void;
  const complete = new Promise<AgLlmResponse>((resolve, reject) => {
    resolveComplete = resolve;
    rejectComplete = reject;
  });
  // A consumer that abandons the stream may never await `complete`; anyone who does still sees
  // the failure. (Same reasoning as AG Studio's OpenAI example adapter.)
  void complete.catch(() => {});

  // A failed turn is reported once, through `complete`, not also thrown from the stream.
  async function* wrapped(): AsyncIterableIterator<AgAiEvent> {
    try {
      yield* events;
    } catch (err) {
      translator.error ??= err instanceof Error ? err : new Error(String(err));
    }
    if (translator.error) rejectComplete(translator.error);
    else if (!translator.started) rejectComplete(new Error('The assistant stream ended without a response.'));
    else resolveComplete(translator.response());
  }

  const iterator = wrapped();
  return { stream: { [Symbol.asyncIterator]: () => iterator }, complete };
}

export function claudeAdapter({ endpoint }: { endpoint: string }): AgLlmAdapter {
  const thinking = new Map<string, StoredThinking>();
  return {
    executeTurn: (request, options) => runTurn(endpoint, thinking, request, options?.signal),
  };
}
