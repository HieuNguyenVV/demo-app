import { extractOutputText, openaiResponses, requireOpenAi } from './openai-client.js';
import { isRecord } from './tool.shared.js';

const REWRITE_TIMEOUT_MS = 8000;
const SEARCH_TIMEOUT_MS = 20000;

export type WebSearchSource = {
  title: string;
  url: string;
  snippet?: string;
};

export type OpenAiWebSearchResult = {
  rewrittenQuery: string;
  sources: WebSearchSource[];
};

export async function rewriteAndSearchWeb(query: string): Promise<OpenAiWebSearchResult> {
  const { apiKey, model } = requireOpenAi();
  const rewrittenQuery = await rewriteQuery(apiKey, model, query);
  const searched = await searchWeb(apiKey, model, rewrittenQuery, query);
  return {
    rewrittenQuery,
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
): Promise<{ sources: WebSearchSource[] }> {
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
      'Search the live web for pages that help answer the question.',
      'Do NOT write an answer, summary, or article.',
      'Return only a short numbered list of the source URLs you found.',
      `Search query: ${rewrittenQuery}`,
      `Original question: ${originalQuery}`,
    ].join('\n'),
  }, SEARCH_TIMEOUT_MS);

  const sources = extractSources(data);
  if (sources.length === 0) {
    throw new Error('OpenAI web search returned no source URLs');
  }
  return { sources };
}

function extractSources(payload: unknown): WebSearchSource[] {
  const found = new Map<string, WebSearchSource>();
  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!isRecord(item)) continue;
      if (item.type === 'web_search_call' && isRecord(item.action) && Array.isArray(item.action.sources)) {
        for (const source of item.action.sources) {
          addSource(found, source);
        }
      }
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (!isRecord(block)) continue;
          if (Array.isArray(block.annotations)) {
            for (const annotation of block.annotations) {
              addSource(found, annotation);
            }
          }
          if (typeof block.text === 'string') {
            addUrlsFromText(found, block.text);
          }
        }
      }
    }
  }

  addUrlsFromText(found, extractOutputText(payload));
  return [...found.values()];
}

function addUrlsFromText(found: Map<string, WebSearchSource>, text: string) {
  const matches = text.match(/https?:\/\/[^\s)\]>"']+/g);
  if (!matches) return;
  for (const raw of matches) {
    addSource(found, { url: raw.replace(/[.,;]+$/, '') });
  }
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
