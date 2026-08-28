import { FileNotFoundError, readUploadedFile } from './file-store.js';
import { analyzeTextContent } from './text-analysis.js';
import type { InvocationClaims } from './sota-auth.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

export type AnalyzeFileResult = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  wordCount: number;
  characterCount: number;
  lineCount: number;
  sentenceCount: number;
  averageWordLength: number;
  readingMinutes: number;
  summary: string;
  preview: string;
  topWords: Array<{ word: string; count: number }>;
  _sota: {
    modelProjection: {
      omitKeys: ['preview', 'topWords'];
    };
  };
};

export function handleAnalyzeFile(input: unknown, claims: InvocationClaims): AnalyzeFileResult {
  const parsed = parseInput(input);
  let stored;
  try {
    stored = readUploadedFile(claims, parsed.fileId);
  } catch (error) {
    if (error instanceof FileNotFoundError) throw error;
    throw error;
  }

  const analysis = analyzeTextContent(stored.content, parsed.topWordsLimit);
  return {
    fileId: stored.record.fileId,
    fileName: stored.record.fileName,
    mimeType: stored.record.mimeType,
    sizeBytes: stored.record.sizeBytes,
    wordCount: analysis.wordCount,
    characterCount: analysis.characterCount,
    lineCount: analysis.lineCount,
    sentenceCount: analysis.sentenceCount,
    averageWordLength: analysis.averageWordLength,
    readingMinutes: analysis.readingMinutes,
    summary: `${stored.record.fileName}: ${analysis.summary}`,
    preview: analysis.preview,
    topWords: analysis.topWords,
    _sota: {
      modelProjection: {
        omitKeys: ['preview', 'topWords'],
      },
    },
  };
}

function parseInput(input: unknown) {
  if (!isRecord(input) || typeof input.fileId !== 'string' || input.fileId.length < 1) {
    throw new InvalidToolInputError('fileId is required');
  }

  const topWordsLimit = typeof input.topWordsLimit === 'number' ? input.topWordsLimit : 5;
  if (!Number.isInteger(topWordsLimit) || topWordsLimit < 3 || topWordsLimit > 10) {
    throw new InvalidToolInputError('topWordsLimit must be an integer from 3 to 10');
  }

  return { fileId: input.fileId, topWordsLimit };
}

export { FileNotFoundError };
