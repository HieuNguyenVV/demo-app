import { rewriteAndSearchWeb } from './openai-web.js';
import { InvalidToolInputError, UpstreamToolError, isRecord } from './tool.shared.js';

export type WebSearchResult = {
  originalQuery: string;
  rewrittenQuery: string;
  sourceCount: number;
  sources: Array<{ title: string; url: string }>;
};

export async function handleWebSearch(input: unknown): Promise<WebSearchResult> {
  const query = parseQuery(input);
  try {
    const result = await rewriteAndSearchWeb(query);
    return {
      originalQuery: query,
      rewrittenQuery: result.rewrittenQuery,
      sourceCount: result.sources.length,
      sources: result.sources.map((source) => ({ title: source.title, url: source.url })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI search failed';
    throw new UpstreamToolError(safeMessage(message));
  }
}

function parseQuery(input: unknown): string {
  if (!isRecord(input) || typeof input.query !== 'string') {
    throw new InvalidToolInputError('query must be a string');
  }
  const query = input.query.trim();
  if (query.length < 2 || query.length > 400) {
    throw new InvalidToolInputError('query must be 2 to 400 characters');
  }
  return query;
}

function safeMessage(message: string): string {
  if (message.includes('OPENAI_API_KEY')) {
    return 'Web search is not configured. Set OPENAI_API_KEY on the app backend.';
  }
  if (message.includes('Timeout') || message.includes('aborted') || message.includes('timeout')) {
    return 'OpenAI web search timed out. Try a shorter query.';
  }
  return `OpenAI web search failed: ${message.slice(0, 160)}`;
}
