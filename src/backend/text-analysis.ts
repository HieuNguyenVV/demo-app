const WORDS_PER_MINUTE = 200;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'to', 'with',
  'và', 'của', 'các', 'là', 'cho', 'với', 'một', 'không', 'được', 'trong',
  'này', 'có', 'để', 'từ', 'những', 'về', 'như', 'khi', 'đã', 'sẽ',
]);

export type TextAnalysis = {
  wordCount: number;
  characterCount: number;
  lineCount: number;
  sentenceCount: number;
  averageWordLength: number;
  readingMinutes: number;
  summary: string;
  preview: string;
  topWords: Array<{ word: string; count: number }>;
};

export function analyzeTextContent(content: string, topWordsLimit = 5): TextAnalysis {
  const trimmed = content.trim();
  const words = tokenize(trimmed);
  const wordCount = words.length;
  const characterCount = content.length;
  const lineCount = content.split(/\r\n|\n|\r/).length;
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
    preview: content.length > 500 ? `${content.slice(0, 500)}…` : content,
    topWords,
  };
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function countSentences(text: string): number {
  if (!text) return 0;
  return text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
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
