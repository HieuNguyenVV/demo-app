import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { InvocationClaims } from './sota-auth.js';

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uploadsRoot = join(dirname(fileURLToPath(import.meta.url)), 'uploads');

export class FileNotFoundError extends Error {
  readonly status = 404 as const;
  readonly code = 'FILE_NOT_FOUND';

  constructor(message = 'Uploaded file was not found for this workspace') {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export type StoredFileRecord = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  lineCount: number;
  createdAt: string;
};

type StoredFileEnvelope = StoredFileRecord & {
  iid: string;
  oid: string;
  wid: string;
};

export function saveUploadedFile(
  claims: InvocationClaims,
  fileName: string,
  mimeType: string,
  content: string,
): StoredFileRecord {
  const fileId = randomUUID();
  const dir = tenantDir(claims);
  mkdirSync(dir, { recursive: true });

  const record: StoredFileEnvelope = {
    fileId,
    fileName,
    mimeType,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    lineCount: content.split(/\r\n|\n|\r/).length,
    createdAt: new Date().toISOString(),
    iid: claims.iid,
    oid: claims.oid,
    wid: claims.wid,
  };

  writeFileSync(join(dir, `${fileId}.json`), JSON.stringify(record), 'utf8');
  writeFileSync(join(dir, `${fileId}.txt`), content, 'utf8');
  return {
    fileId: record.fileId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    lineCount: record.lineCount,
    createdAt: record.createdAt,
  };
}

export function readUploadedFile(claims: InvocationClaims, fileId: string): {
  record: StoredFileRecord;
  content: string;
} {
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw new FileNotFoundError();
  }

  const dir = tenantDir(claims);
  const metaPath = join(dir, `${fileId}.json`);
  if (!existsSync(metaPath)) {
    throw new FileNotFoundError();
  }

  const envelope = JSON.parse(readFileSync(metaPath, 'utf8')) as StoredFileEnvelope;
  if (envelope.iid !== claims.iid || envelope.oid !== claims.oid || envelope.wid !== claims.wid) {
    throw new FileNotFoundError();
  }

  return {
    record: {
      fileId: envelope.fileId,
      fileName: envelope.fileName,
      mimeType: envelope.mimeType,
      sizeBytes: envelope.sizeBytes,
      lineCount: envelope.lineCount,
      createdAt: envelope.createdAt,
    },
    content: readFileSync(join(dir, `${fileId}.txt`), 'utf8'),
  };
}

export function saveBinaryFile(
  claims: InvocationClaims,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): StoredFileRecord {
  const fileId = randomUUID();
  const dir = tenantDir(claims);
  mkdirSync(dir, { recursive: true });

  const record: StoredFileEnvelope = {
    fileId,
    fileName,
    mimeType,
    sizeBytes: buffer.byteLength,
    lineCount: 1,
    createdAt: new Date().toISOString(),
    iid: claims.iid,
    oid: claims.oid,
    wid: claims.wid,
  };

  writeFileSync(join(dir, `${fileId}.json`), JSON.stringify(record), 'utf8');
  writeFileSync(join(dir, `${fileId}.bin`), buffer);
  return {
    fileId: record.fileId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    lineCount: record.lineCount,
    createdAt: record.createdAt,
  };
}

export function readBinaryFile(claims: InvocationClaims, fileId: string): {
  record: StoredFileRecord;
  buffer: Buffer;
} {
  const stored = readUploadedFile(claims, fileId);
  const binPath = join(tenantDir(claims), `${fileId}.bin`);
  if (existsSync(binPath)) {
    return { record: stored.record, buffer: readFileSync(binPath) };
  }
  return { record: stored.record, buffer: Buffer.from(stored.content, 'utf8') };
}

function tenantDir(claims: Pick<InvocationClaims, 'iid' | 'oid' | 'wid'>): string {
  const key = createHash('sha256')
    .update(`${claims.iid}\0${claims.oid}\0${claims.wid}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return join(uploadsRoot, key);
}
