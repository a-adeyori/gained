// Chat completions through Elastic's managed LLMs. Calls go through a Kibana `.inference`
// connector (the route Elastic's own AI Assistant uses): on our Serverless trial the direct
// `_inference/chat_completion` endpoints answer 403, while the connectors work. The connector
// takes text messages only, so images can't be sent. Server-only.

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

type ExecuteResponse = {
  status: 'ok' | 'error';
  message?: string;
  service_message?: string;
  retry?: boolean;
  data?: {
    choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
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

/**
 * Sends one chat request and forces the model to answer by calling `tool`, so the reply is
 * the tool's JSON arguments. Returns them unparsed; the caller validates against its schema.
 */
export async function callTool(messages: Message[], tool: Tool, connectorId?: string): Promise<string> {
  const key = process.env.ELASTIC_API_KEY;
  if (!key) throw new ElasticError('ELASTIC_API_KEY must be set (see .env.local)', false);
  const connector = connectorId ?? process.env.ELASTIC_CONNECTOR_ID ?? 'Anthropic-Claude-Sonnet-4-5';

  const res = await fetch(`${kibanaUrl()}/api/actions/connector/${encodeURIComponent(connector)}/_execute`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json', 'kbn-xsrf': 'gained' },
    body: JSON.stringify({
      params: {
        subAction: 'unified_completion',
        subActionParams: {
          body: {
            messages,
            tools: [{ type: 'function', function: tool }],
            tool_choice: { type: 'function', function: { name: tool.name } },
          },
        },
      },
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    // 401/403/404 are a key or connector problem; 429 and 5xx may pass on a retry.
    throw new ElasticError(`Kibana ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status === 429 || res.status >= 500);
  }

  const body = (await res.json()) as ExecuteResponse;
  if (body.status !== 'ok') {
    throw new ElasticError(`${body.message ?? 'Connector error'}: ${body.service_message ?? ''}`.slice(0, 400), body.retry ?? true);
  }
  const call = body.data?.choices?.[0]?.message?.tool_calls?.find((c) => c.function?.name === tool.name);
  if (!call?.function?.arguments) throw new ElasticError('The model answered without calling the tool', true);
  return call.function.arguments;
}
