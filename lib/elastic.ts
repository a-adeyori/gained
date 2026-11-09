// Chat completions through Elastic's managed LLMs. Calls go through a Kibana `.inference`
// connector (the route Elastic's own AI Assistant uses): on our Serverless trial the direct
// `_inference/chat_completion` endpoints answer 403, while the connectors work. The connector
// takes text messages only, so images can't be sent, and its streaming sub-action doesn't stream
// through this API, so replies arrive whole. Server-only.

export class ElasticError extends Error {
  constructor(
    message: string,
    /** False when a retry can't help, e.g. a missing key or a rejected request. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ElasticError';
  }
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type Tool = { name: string; description: string; parameters: Record<string, unknown> };

/** An OpenAI-style chat message, as the connector's `unified_completion` takes them. */
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  // The connector rejects `content: null`, so a tool-only assistant turn leaves `content` out.
  | { role: 'assistant'; content?: string; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type ChatToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatTool = { type: 'function'; function: { name: string; description?: string; parameters: Record<string, unknown> } };
export type ChatRequest = {
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
};
export type ChatReply = {
  id?: string;
  model?: string;
  content: string | null;
  toolCalls: ChatToolCall[];
  usage: { promptTokens: number; completionTokens: number };
};

type ExecuteResponse = {
  status: 'ok' | 'error';
  message?: string;
  service_message?: string;
  retry?: boolean;
  data?: {
    id?: string;
    model?: string;
    choices?: { message?: { content?: string | null; tool_calls?: Partial<ChatToolCall>[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
};

/** Kibana's address. Serverless projects serve it at the Elasticsearch host with `.kb.` for `.es.`. */
function kibanaUrl() {
  const explicit = process.env.ELASTIC_KIBANA_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const es = process.env.ELASTIC_URL;
  if (!es) throw new ElasticError('ELASTIC_URL must be set (see .env.local)', false);
  return es.replace(/\/$/, '').replace('.es.', '.kb.');
}

/** Whether ELASTIC_URL and ELASTIC_API_KEY are both set. */
export const elasticConfigured = () => Boolean(process.env.ELASTIC_API_KEY && (process.env.ELASTIC_URL || process.env.ELASTIC_KIBANA_URL));

/** Sends one chat request through the connector and returns the reply's text and tool calls. */
export async function chat(body: ChatRequest, options: { connectorId?: string; signal?: AbortSignal } = {}): Promise<ChatReply> {
  const key = process.env.ELASTIC_API_KEY;
  if (!key) throw new ElasticError('ELASTIC_API_KEY must be set (see .env.local)', false);
  const connector = options.connectorId ?? process.env.ELASTIC_CONNECTOR_ID ?? 'Anthropic-Claude-Sonnet-4-5';

  const res = await fetch(`${kibanaUrl()}/api/actions/connector/${encodeURIComponent(connector)}/_execute`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json', 'kbn-xsrf': 'gained' },
    body: JSON.stringify({ params: { subAction: 'unified_completion', subActionParams: { body } } }),
    cache: 'no-store',
    signal: options.signal,
  });
  if (!res.ok) {
    // 401/403/404 are a key or connector problem; 429 and 5xx may pass on a retry.
    throw new ElasticError(`Kibana ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status === 429 || res.status >= 500);
  }

  const reply = (await res.json()) as ExecuteResponse;
  if (reply.status !== 'ok') {
    throw new ElasticError(`${reply.message ?? 'Connector error'}: ${reply.service_message ?? ''}`.slice(0, 400), reply.retry ?? true);
  }
  const message = reply.data?.choices?.[0]?.message;
  return {
    id: reply.data?.id,
    model: reply.data?.model,
    content: message?.content ?? null,
    toolCalls: (message?.tool_calls ?? []).flatMap((c): ChatToolCall[] =>
      c.function?.name
        ? [{ id: c.id ?? `call_${Math.random().toString(36).slice(2)}`, type: 'function', function: { name: c.function.name, arguments: c.function.arguments ?? '{}' } }]
        : [],
    ),
    usage: { promptTokens: reply.data?.usage?.prompt_tokens ?? 0, completionTokens: reply.data?.usage?.completion_tokens ?? 0 },
  };
}

/**
 * Sends one chat request and forces the model to answer by calling `tool`, so the reply is
 * the tool's JSON arguments. Returns them unparsed; the caller validates against its schema.
 */
export async function callTool(messages: Message[], tool: Tool, connectorId?: string): Promise<string> {
  const reply = await chat(
    {
      messages,
      tools: [{ type: 'function', function: tool }],
      tool_choice: { type: 'function', function: { name: tool.name } },
    },
    { connectorId },
  );
  const call = reply.toolCalls.find((c) => c.function.name === tool.name);
  if (!call) throw new ElasticError('The model answered without calling the tool', true);
  return call.function.arguments;
}
