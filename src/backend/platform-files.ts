const coreOrigin = process.env.SOTA_CORE_ORIGIN ?? 'https://api.v4.stg.sotaagents.ai';
const MAX_PLATFORM_FILE_BYTES = 20000;
const PLATFORM_FILE_ID_PATTERN = /^[A-Za-z0-9._-]{8,120}$/;

export class PlatformFileError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PlatformFileError';
    this.status = status;
    this.code = code;
  }
}

export type PlatformFileContent = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: string;
};

export function assertPlatformFileId(fileId: string) {
  if (!PLATFORM_FILE_ID_PATTERN.test(fileId)) {
    throw new PlatformFileError(400, 'INVALID_INPUT', 'platformFileId is invalid');
  }
}

export async function downloadPlatformFile(
  invocationToken: string,
  platformFileId: string,
  fileName?: string,
): Promise<PlatformFileContent> {
  assertPlatformFileId(platformFileId);

  const url = new URL(`/api/v1/files/${encodeURIComponent(platformFileId)}/download`, coreOrigin);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${invocationToken}`,
      accept: 'text/plain, text/csv, text/markdown, application/json, */*',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 404) {
    throw new PlatformFileError(404, 'FILE_NOT_FOUND', 'Chat attachment was not found or is not accessible');
  }
  if (!response.ok) {
    throw new PlatformFileError(
      response.status,
      'PLATFORM_FILE_ERROR',
      `Could not download chat attachment (HTTP ${response.status})`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_PLATFORM_FILE_BYTES) {
    throw new PlatformFileError(
      400,
      'INVALID_INPUT',
      `Attachment must be between 1 and ${MAX_PLATFORM_FILE_BYTES} bytes for analysis`,
    );
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'text/plain';
  if (!isSupportedTextMime(mimeType)) {
    throw new PlatformFileError(400, 'INVALID_INPUT', `Unsupported attachment type for analysis: ${mimeType}`);
  }

  return {
    fileId: platformFileId,
    fileName: fileName || parseFilename(response.headers.get('content-disposition')) || platformFileId,
    mimeType,
    sizeBytes: buffer.byteLength,
    content: buffer.toString('utf8'),
  };
}

function isSupportedTextMime(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/csv';
}

function parseFilename(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) return undefined;
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1];
}
