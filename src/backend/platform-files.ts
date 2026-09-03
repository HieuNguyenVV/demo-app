import type { InvocationClaims } from './sota-auth.js';

const coreOrigin = process.env.SOTA_CORE_ORIGIN ?? 'https://api.v4.sotaagents.ai';
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
  claims: InvocationClaims,
  fileName?: string,
  coreDelegationToken?: string,
): Promise<PlatformFileContent> {
  assertPlatformFileId(platformFileId);

  const url = new URL(`/api/files/${encodeURIComponent(platformFileId)}/download`, coreOrigin);
  const bearer = coreDelegationToken || invocationToken;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${bearer}`,
      accept: 'application/json, text/plain, */*',
      origin: webOriginFromCore(coreOrigin),
      'x-org-id': claims.oid,
      'x-ws-id': claims.wid,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    console.error(JSON.stringify({
      event: 'platform_file_download_failed',
      platformFileId,
      coreStatus: response.status,
      coreHost: url.host,
      corePath: url.pathname,
      usedDelegationToken: Boolean(coreDelegationToken),
    }));
  }

  if (response.status === 401 || response.status === 403) {
    throw new PlatformFileError(
      401,
      'PLATFORM_FILE_ERROR',
      'Core rejected the app credential for /api/files/{id}/download (user session required). Retry upload-file with source "platform", platformFileId, fileName, and the full attachment text in content.',
    );
  }
  if (response.status === 404) {
    throw new PlatformFileError(
      400,
      'FILE_NOT_FOUND',
      'Chat attachment was not found or is not accessible. Pass the chat attachment fileId as platformFileId with source "platform", or use source "content" with the full text.',
    );
  }
  if (!response.ok) {
    throw new PlatformFileError(
      response.status >= 400 && response.status < 500 ? response.status : 502,
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

export async function downloadPlatformPdf(
  invocationToken: string,
  platformFileId: string,
  claims: InvocationClaims,
  fileName?: string,
  coreDelegationToken?: string,
): Promise<{ fileName: string; mimeType: string; buffer: Buffer }> {
  assertPlatformFileId(platformFileId);

  const url = new URL(`/api/files/${encodeURIComponent(platformFileId)}/download`, coreOrigin);
  const bearer = coreDelegationToken || invocationToken;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${bearer}`,
      accept: 'application/pdf, application/octet-stream, */*',
      origin: webOriginFromCore(coreOrigin),
      'x-org-id': claims.oid,
      'x-ws-id': claims.wid,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new PlatformFileError(
      400,
      'PLATFORM_FILE_ERROR',
      'Core cannot download the chat PDF (no user session on the app). Retry pdf with source "platform", platformFileId, fileName, and the full attachment text in content — same workaround as upload-file.',
    );
  }
  if (!response.ok) {
    throw new PlatformFileError(
      response.status === 404 ? 400 : (response.status >= 400 && response.status < 500 ? response.status : 502),
      'PLATFORM_FILE_ERROR',
      `Could not download the chat PDF (HTTP ${response.status})`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 8 || buffer.byteLength > 1_500_000) {
    throw new PlatformFileError(400, 'INVALID_INPUT', 'PDF must be between 8 bytes and 1.5 MB');
  }
  if (!buffer.subarray(0, 5).toString('utf8').startsWith('%PDF')) {
    throw new PlatformFileError(400, 'INVALID_INPUT', 'Chat attachment is not a PDF');
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/pdf';
  return {
    fileName: fileName || parseFilename(response.headers.get('content-disposition')) || `${platformFileId}.pdf`,
    mimeType,
    buffer,
  };
}

function webOriginFromCore(origin: string): string {
  const fromEnv = process.env.SOTA_WEB_ORIGIN?.trim();
  if (fromEnv) return fromEnv;
  const url = new URL(origin);
  if (url.hostname === 'api.v4.sotaagents.ai') {
    return 'https://app.sotaagents.ai';
  }
  if (url.hostname === 'api.v4.stg.sotaagents.ai') {
    return 'https://v4.stg.sotaagents.ai';
  }
  url.hostname = url.hostname.replace(/^api\./, '');
  return url.origin;
}

function isSupportedTextMime(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/csv';
}

function parseFilename(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) return undefined;
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1];
}
