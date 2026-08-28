import { InvalidToolInputError, isRecord } from './tool.shared.js';

const MAX_TEXT_LENGTH = 8000;

export type CountWordsResult = {
  wordCount: number;
  characterCount: number;
  lineCount: number;
};

export function handleCountWords(input: unknown): CountWordsResult {
  const text = parseText(input);
  const trimmed = text.trim();
  return {
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
    characterCount: text.length,
    lineCount: text.split(/\r\n|\n|\r/).length,
  };
}

function parseText(input: unknown): string {
  if (!isRecord(input) || typeof input.text !== 'string') {
    throw new InvalidToolInputError('text is required');
  }
  if (input.text.length < 1 || input.text.length > MAX_TEXT_LENGTH) {
    throw new InvalidToolInputError(`text must be between 1 and ${MAX_TEXT_LENGTH} characters`);
  }
  return input.text;
}

export { InvalidToolInputError };
