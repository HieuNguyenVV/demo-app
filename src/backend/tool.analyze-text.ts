import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const MAX_TEXT_LENGTH = 8000;
const WORDS_PER_MINUTE = 200;
const SAMPLE_FILES = ['sample-article.txt', 'sample-notes.txt'] as const;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'to', 'with',
]);

export type AnalyzeTextInput = {
  source: 'text' | 'file';
  text?: string;
  fileName?: (typeof SAMPLE_FILES)[number];
  topWordsLimit?: number;
};

export type AnalyzeTextResult = {
  source: 'text' | 'file';
  fileName?: string;
  wordCount: number;
  characterCount: number;
  lineCount: number;
  sentenceCount: number;
  averageWordLength: number;
  readingMinutes: number;
  summary: string;
  topWords: Array<{ word: string; count: number }>;
  _sota: {
    modelProjection: {
      omitKeys: ['topWords'];
    };
  };
};

export function handleAnalyzeText(input: unknown): AnalyzeTextResult {
  const parsed = parseInput(input);
  const content = parsed.source === 'text'
    ? parsed.text!
    : readSampleFile(parsed.fileName!);
  const stats = analyzeContent(content, parsed.topWordsLimit ?? 5);

  return {
    source: parsed.source,
    ...(parsed.source === 'file' ? { fileName: parsed.fileName } : {}),
    ...stats,
    _sota: {
      modelProjection: {
        omitKeys: ['topWords'],
      },
    },
  };
}

function parseInput(input: unknown): AnalyzeTextInput {
  if (!isRecord(input) || (input.source !== 'text' && input.source !== 'file')) {
    throw new InvalidToolInputError('source must be "text" or "file"');
  }

  const topWordsLimit = typeof input.topWordsLimit === 'number'
    ? input.topWordsLimit
    : 5;
  if (!Number.isInteger(topWordsLimit) || topWordsLimit < 3 || topWordsLimit > 10) {
    throw new InvalidToolInputError('topWordsLimit must be an integer from 3 to 10');
  }

  if (input.source === 'text') {
    if (typeof input.text !== 'string') {
      throw new InvalidToolInputError('text is required when source is text');
    }
    if (input.text.length < 1 || input.text.length > MAX_TEXT_LENGTH) {
      throw new InvalidToolInputError(`text must be between 1 and ${MAX_TEXT_LENGTH} characters`);
    }
    return { source: 'text', text: input.text, topWordsLimit };
  }

  if (typeof input.fileName !== 'string' || !SAMPLE_FILES.includes(input.fileName as typeof SAMPLE_FILES[number])) {
    throw new InvalidToolInputError(`fileName must be one of: ${SAMPLE_FILES.join(', ')}`);
  }
  return {
    source: 'file',
    fileName: input.fileName as AnalyzeTextInput['fileName'],
    topWordsLimit,
  };
}

function readSampleFile(fileName: string): string {
  const safeName = SAMPLE_FILES.find((name) => name === fileName);
  if (!safeName) {
    throw new InvalidToolInputError(`fileName must be one of: ${SAMPLE_FILES.join(', ')}`);
  }
  const path = join(dirname(fileURLToPath(import.meta.url)), 'data', safeName);
  return readFileSync(path, 'utf8');
}

function analyzeContent(text: string, topWordsLimit: number) {
  const trimmed = text.trim();
  const words = tokenize(trimmed);
  const wordCount = words.length;
  const characterCount = text.length;
  const lineCount = text.split(/\r\n|\n|\r/).length;
  const sentenceCount = countSentences(trimmed);
  const averageWordLength = wordCount === 0
    ? 0
    : Number((words.reduce((total, word) => total + word.length, 0) / wordCount).toFixed(1));
  const readingMinutes = Number((wordCount / WORDS_PER_MINUTE).toFixed(1));
  const topWords = topKeywords(words, topWordsLimit);
  const summary = [
    `${wordCount} words`,
    `${sentenceCount} sentences`,
    `${readingMinutes} min read`,
    topWords[0] ? `top term "${topWords[0].word}"` : 'no dominant term',
  ].join(', ');

  return {
    wordCount,
    characterCount,
    lineCount,
    sentenceCount,
    averageWordLength,
    readingMinutes,
    summary,
    topWords,
  };
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .match(/[a-z0-9']+/g) ?? [];
}

function countSentences(text: string): number {
  if (!text) return 0;
  const parts = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  return parts.length;
}

function topKeywords(words: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}
