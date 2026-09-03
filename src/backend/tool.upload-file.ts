import { saveUploadedFile } from './file-store.js';
import { downloadPlatformFile, PlatformFileError } from './platform-files.js';
import type { InvocationClaims } from './sota-auth.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const MAX_CONTENT_LENGTH = 20000;
const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
]);

export type UploadFileResult = {
  source: 'content' | 'platform';
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  lineCount: number;
  summary: string;
  platformFileId?: string;
};

export async function handleUploadFile(
  input: unknown,
  claims: InvocationClaims,
  invocationToken: string,
  coreDelegationToken?: string,
): Promise<UploadFileResult> {
  const parsed = await parseInput(input, claims, invocationToken, coreDelegationToken);
  const record = saveUploadedFile(claims, parsed.fileName, parsed.mimeType, parsed.content);
  return {
    source: parsed.source,
    ...record,
    ...(parsed.source === 'platform' ? { platformFileId: parsed.platformFileId } : {}),
    summary: parsed.source === 'platform'
      ? `Uploaded chat attachment ${parsed.fileName} to app storage as ${record.fileId}.`
      : `Uploaded ${record.fileName} as ${record.fileId} (${record.sizeBytes} bytes, ${record.lineCount} lines).`,
  };
}

async function parseInput(
  input: unknown,
  claims: InvocationClaims,
  invocationToken: string,
  coreDelegationToken?: string,
) {
  if (!isRecord(input)) {
    throw new InvalidToolInputError('input must be an object');
  }

  if (input.source !== 'content' && input.source !== 'platform') {
    throw new InvalidToolInputError('source must be "content" or "platform"');
  }

  if (input.source === 'platform') {
    if (typeof input.platformFileId !== 'string' || input.platformFileId.length < 1) {
      throw new InvalidToolInputError('platformFileId is required when source is platform');
    }

    const downloaded = await downloadPlatformFile(
      invocationToken,
      input.platformFileId,
      claims,
      typeof input.fileName === 'string' ? input.fileName : undefined,
      coreDelegationToken,
    );

    return {
      source: 'platform' as const,
      platformFileId: input.platformFileId,
      fileName: sanitizeFileName(downloaded.fileName),
      mimeType: downloaded.mimeType,
      content: downloaded.content,
    };
  }

  if (typeof input.fileName !== 'string' || !FILE_NAME_PATTERN.test(input.fileName)) {
    throw new InvalidToolInputError('fileName must use letters, numbers, dots, dashes, or underscores only');
  }

  if (typeof input.content !== 'string' || input.content.length < 1 || input.content.length > MAX_CONTENT_LENGTH) {
    throw new InvalidToolInputError(`content must be between 1 and ${MAX_CONTENT_LENGTH} characters`);
  }

  const mimeType = typeof input.mimeType === 'string' ? input.mimeType : inferMimeType(input.fileName);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new InvalidToolInputError('mimeType must be text/plain, text/csv, text/markdown, or application/json');
  }

  return {
    source: 'content' as const,
    fileName: sanitizeFileName(input.fileName),
    mimeType,
    content: input.content,
  };
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.replace(/\.(txt|csv|md|json)$/i, '');
  if (!FILE_NAME_PATTERN.test(base)) {
    throw new InvalidToolInputError('fileName must use letters, numbers, dots, dashes, or underscores only');
  }
  return base;
}

function inferMimeType(fileName: string): string {
  if (/\.csv$/i.test(fileName)) return 'text/csv';
  if (/\.md$/i.test(fileName)) return 'text/markdown';
  if (/\.json$/i.test(fileName)) return 'application/json';
  return 'text/plain';
}

export { PlatformFileError };
