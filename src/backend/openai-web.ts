import { isRecord } from './tool.shared.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-4o-mini';
const REWRITE_TIMEOUT_MS = 8000;
const SEARCH_TIMEOUT_MS = 20000;

export type WebSearchSource = {
  title: string;
  url: string;
  snippet?: string;
};

export type OpenAiWebSearchResult = {
  rewrittenQuery: string;
  summary: string;
  sources: WebSearchSource[];
};

export async function rewriteAndSearchWeb(query: string): Promise<OpenAiWebSearchResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the app backend');
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const rewrittenQuery = await rewriteQuery(apiKey, model, query);
  const searched = await searchWeb(apiKey, model, rewrittenQuery, query);
  return {
    rewrittenQuery,
    summary: searched.summary,
    sources: searched.sources.slice(0, 8),
  };
}

async function rewriteQuery(apiKey: string, model: string, query: string): Promise<string> {
  const data = await openaiResponses(apiKey, {
    model,
    input: [
      'Rewrite this user question into one effective web search query.',
      'Keep the original language. Expand abbreviations. Add Vietnam context only if the question is clearly local.',
      'Output ONLY the rewritten query, with no quotes or extra commentary.',
      '',
      `User question: ${query}`,
    ].join('\n'),
  }, REWRITE_TIMEOUT_MS);
  const text = extractOutputText(data).replace(/^["']|["']$/g, '').trim();
  return text.slice(0, 300) || query;
}

async function searchWeb(
  apiKey: string,
  model: string,
  rewrittenQuery: string,
  originalQuery: string,
): Promise<{ summary: string; sources: WebSearchSource[] }> {
  const data = await openaiResponses(apiKey, {
    model,
    tools: [
      {
        type: 'web_search',
        user_location: {
          type: 'approximate',
          country: 'VN',
          timezone: 'Asia/Ho_Chi_Minh',
        },
      },
    ],
    include: ['web_search_call.action.sources'],
    input: [
      'Search the live web and answer the user. Cite sources. Prefer recent, reputable pages.',
      'If the user wrote in Vietnamese, answer in Vietnamese.',
      `Search query: ${rewrittenQuery}`,
      `Original question: ${originalQuery}`,
    ].join('\n'),
  }, SEARCH_TIMEOUT_MS);

  const summary = extractOutputText(data).slice(0, 4000);
  const sources = extractSources(data);
  if (!summary) {
    throw new Error('OpenAI returned an empty search answer');
  }
  return { summary, sources };
}

async function openaiResponses(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = openaiErrorMessage(payload) || `OpenAI HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload)) return '';
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload.output)) return '';
  const parts: string[] = [];
  for (const item of payload.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (isRecord(block) && typeof block.text === 'string') parts.push(block.text);
    }
  }
  return parts.join('\n').trim();
}

function extractSources(payload: unknown): WebSearchSource[] {
  const found = new Map<string, WebSearchSource>();
  if (!isRecord(payload) || !Array.isArray(payload.output)) return [];

  for (const item of payload.output) {
    if (!isRecord(item)) continue;
    if (item.type === 'web_search_call' && isRecord(item.action) && Array.isArray(item.action.sources)) {
      for (const source of item.action.sources) {
        addSource(found, source);
      }
    }
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (!isRecord(block) || !Array.isArray(block.annotations)) continue;
        for (const annotation of block.annotations) {
          addSource(found, annotation);
        }
      }
    }
  }

  return [...found.values()];
}

function addSource(found: Map<string, WebSearchSource>, value: unknown) {
  if (!isRecord(value)) return;
  const url = typeof value.url === 'string' ? sanitizeUrl(value.url) : undefined;
  if (!url || found.has(url)) return;
  const title = typeof value.title === 'string' && value.title.trim()
    ? value.title.trim().slice(0, 160)
    : hostname(url);
  found.set(url, { title, url });
}

function sanitizeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

function openaiErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  if (typeof payload.error.message !== 'string') return undefined;
  return payload.error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 180);
}
