import { isRecord } from './tool.shared.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-4o-mini';

export function requireOpenAi(): { apiKey: string; model: string } {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the app backend');
  }
  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export async function openaiResponses(
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

export function extractOutputText(payload: unknown): string {
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

export function parseJsonObject(text: string): Record<string, unknown> {
  const stripped = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('OpenAI did not return JSON');
  }
  const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('OpenAI JSON must be an object');
  }
  return parsed;
}

export function openaiErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  if (typeof payload.error.message !== 'string') return undefined;
  return payload.error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 180);
}
