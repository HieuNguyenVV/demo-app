import { readBinaryFile, saveBinaryFile } from './file-store.js';
import { createOfficePdf, editOfficePdf, extractPdfText, type EditMode, type OfficeDocType, type StampPosition } from './pdf-office.js';
import { downloadPlatformPdf, PlatformFileError } from './platform-files.js';
import { analyzeTextContent } from './text-analysis.js';
import type { InvocationClaims } from './sota-auth.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const ACTIONS = ['create', 'edit', 'extract', 'analyze'] as const;
const DOC_TYPES = ['memo', 'report', 'letter', 'minutes', 'proposal', 'other'] as const;
const EDIT_MODES = ['stamp', 'append-page', 'cover-page', 'page-range'] as const;
const MIME_TYPE = 'application/pdf';

type PdfAction = (typeof ACTIONS)[number];

export type PdfToolResult = {
  action: PdfAction;
  summary: string;
  fileName?: string;
  fileId?: string;
  docType?: string;
  mimeType?: string;
  contentEncoding?: 'base64';
  sizeBytes?: number;
  pageCount?: number;
  wordCount?: number;
  readingMinutes?: number;
  preview?: string;
  extractedText?: string;
  content?: string;
  topWords?: Array<{ word: string; count: number }>;
  _sota: {
    modelProjection: {
        omitKeys: ['content'];
    };
  };
};

export async function handlePdf(
  input: unknown,
  claims: InvocationClaims,
  invocationToken: string,
  coreDelegationToken?: string,
): Promise<PdfToolResult> {
  const parsed = parseInput(input);
  if (parsed.action === 'create') {
    try {
      return finishPdf(claims, parsed.fileName, 'create', parsed.docType, await createOfficePdf({
        title: parsed.title,
        docType: parsed.docType,
        organization: parsed.organization,
        date: parsed.date,
        body: parsed.text,
        signer: parsed.signer,
        signerTitle: parsed.signerTitle,
      }));
    } catch (error) {
      throw new InvalidToolInputError(error instanceof Error ? error.message : 'Could not create the PDF');
    }
  }

  if (parsed.source === 'platform' && parsed.content) {
    return handleVisibleAttachment(claims, parsed);
  }

  const source = await loadPdf(parsed, claims, invocationToken, coreDelegationToken);
  if (parsed.action === 'edit') {
    try {
      const edited = await editOfficePdf(source.buffer, parsed.editMode, {
        text: parsed.text,
        stampPosition: parsed.stampPosition,
        pageStart: parsed.pageStart,
        pageEnd: parsed.pageEnd,
        title: parsed.title,
      });
      return finishPdf(claims, parsed.fileName, 'edit', parsed.docType, edited);
    } catch (error) {
      throw new InvalidToolInputError(error instanceof Error ? error.message : 'Could not edit the PDF');
    }
  }

  let extracted;
  try {
    extracted = await extractPdfText(source.buffer);
  } catch (error) {
    throw new InvalidToolInputError(error instanceof Error ? error.message : 'Could not read text from the PDF');
  }

  if (parsed.action === 'extract') {
    return {
      action: 'extract',
      fileName: source.fileName,
      pageCount: extracted.pageCount,
      wordCount: extracted.text ? extracted.text.split(/\s+/).filter(Boolean).length : 0,
      preview: extracted.text.slice(0, 500),
      extractedText: extracted.text.slice(0, 20000),
      summary: `Extracted ${extracted.pageCount} page(s) from ${source.fileName} for copy into email or Word.`,
      _sota: { modelProjection: { omitKeys: ['content'] } },
    };
  }

  const analysis = analyzeTextContent(extracted.text || ' ', 8);
  return {
    action: 'analyze',
    fileName: source.fileName,
    pageCount: extracted.pageCount,
    wordCount: analysis.wordCount,
    readingMinutes: analysis.readingMinutes,
    preview: analysis.preview,
    extractedText: extracted.text.slice(0, 20000),
    topWords: analysis.topWords,
    summary: `${source.fileName}: ${extracted.pageCount} pages, ${analysis.summary}. Ready for a meeting brief.`,
    _sota: { modelProjection: { omitKeys: ['content'] } },
  };
}

function finishPdf(
  claims: InvocationClaims,
  fileName: string,
  action: 'create' | 'edit',
  docType: OfficeDocType,
  buffer: Buffer,
): PdfToolResult {
  const stored = saveBinaryFile(claims, `${fileName}.pdf`, MIME_TYPE, buffer);
  return {
    action,
    fileName: stored.fileName,
    fileId: stored.fileId,
    docType,
    mimeType: MIME_TYPE,
    contentEncoding: 'base64',
    sizeBytes: stored.sizeBytes,
    content: buffer.toString('base64'),
    summary: action === 'create'
      ? `Created office PDF ${stored.fileName} (${formatSize(stored.sizeBytes)}). Download the card under the message.`
      : `Updated office PDF ${stored.fileName} (${formatSize(stored.sizeBytes)}). Download the card under the message.`,
    _sota: { modelProjection: { omitKeys: ['content'] } },
  };
}

async function loadPdf(
  parsed: ReturnType<typeof parseInput>,
  claims: InvocationClaims,
  invocationToken: string,
  coreDelegationToken?: string,
) {
  if (parsed.source === 'file') {
    const stored = readBinaryFile(claims, parsed.fileId);
    if (!stored.record.mimeType.includes('pdf') && !stored.record.fileName.toLowerCase().endsWith('.pdf')) {
      throw new InvalidToolInputError('fileId must point to a PDF created by the pdf tool');
    }
    return { fileName: stored.record.fileName, buffer: stored.buffer };
  }

  if (parsed.source === 'base64') {
    const buffer = Buffer.from(parsed.pdfBase64, 'base64');
    if (buffer.byteLength < 8 || !buffer.subarray(0, 5).toString('utf8').startsWith('%PDF')) {
      throw new InvalidToolInputError('pdfBase64 must be a real PDF');
    }
    return { fileName: `${parsed.fileName}.pdf`, buffer };
  }

  if (parsed.source === 'platform' && parsed.pdfBase64) {
    const buffer = Buffer.from(parsed.pdfBase64, 'base64');
    if (buffer.byteLength < 8 || !buffer.subarray(0, 5).toString('utf8').startsWith('%PDF')) {
      throw new InvalidToolInputError('pdfBase64 must be a real PDF');
    }
    return { fileName: `${parsed.fileName}.pdf`, buffer };
  }

  return downloadPlatformPdf(
    invocationToken,
    parsed.platformFileId,
    claims,
    `${parsed.fileName}.pdf`,
    coreDelegationToken,
  );
}

function parseInput(input: unknown) {
  if (!isRecord(input) || typeof input.action !== 'string' || !ACTIONS.includes(input.action as PdfAction)) {
    throw new InvalidToolInputError('action must be create, edit, extract, or analyze');
  }
  const action = input.action as PdfAction;
  const fileName = parseFileName(input.fileName, action);
  const docType = parseDocType(input.docType);

  if (action === 'create') {
    if (typeof input.title !== 'string' || input.title.trim().length < 1) {
      throw new InvalidToolInputError('title is required to create an office PDF');
    }
    if (typeof input.text !== 'string' || input.text.trim().length < 1) {
      throw new InvalidToolInputError('text is required to create an office PDF');
    }
    return {
      action,
      fileName,
      docType,
      title: input.title.trim(),
      text: input.text.trim(),
      organization: optionalString(input.organization, 120, 'organization'),
      date: optionalString(input.date, 40, 'date'),
      signer: optionalString(input.signer, 80, 'signer'),
      signerTitle: optionalString(input.signerTitle, 80, 'signerTitle'),
      editMode: 'stamp' as EditMode,
      stampPosition: 'header' as StampPosition,
      pageStart: undefined as number | undefined,
      pageEnd: undefined as number | undefined,
      source: 'file' as const,
      fileId: '',
      platformFileId: '',
      pdfBase64: '',
      content: '',
    };
  }

  const source = parseSource(input);
  const editMode = parseEditMode(input.editMode, action);
  return {
    action,
    fileName,
    docType,
    title: optionalString(input.title, 160, 'title') || '',
    text: optionalString(input.text, 12000, 'text') || '',
    organization: undefined as string | undefined,
    date: undefined as string | undefined,
    signer: undefined as string | undefined,
    signerTitle: undefined as string | undefined,
    editMode,
    stampPosition: parseStamp(input.stampPosition),
    pageStart: optionalInt(input.pageStart, 'pageStart'),
    pageEnd: optionalInt(input.pageEnd, 'pageEnd'),
    ...source,
    content: parseAttachmentContent(input.content),
  };
}

function parseAttachmentContent(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 20000) {
    throw new InvalidToolInputError('content must be between 1 and 20000 characters');
  }
  return value;
}

function textStats(text: string) {
  const trimmed = text.trim();
  return {
    preview: trimmed.slice(0, 500),
    extractedText: trimmed.slice(0, 20000),
    wordCount: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
  };
}

async function handleVisibleAttachment(
  claims: InvocationClaims,
  parsed: ReturnType<typeof parseInput>,
): Promise<PdfToolResult> {
  const fileName = parsed.fileName === 'document' ? 'chat-attachment' : parsed.fileName;
  if (parsed.action === 'extract') {
    const stats = textStats(parsed.content);
    return {
      action: 'extract',
      fileName: `${fileName}.pdf`,
      pageCount: 1,
      wordCount: stats.wordCount,
      preview: stats.preview,
      extractedText: stats.extractedText,
      summary: `Extracted visible text from chat PDF ${fileName}.pdf (Core file download skipped).`,
      _sota: { modelProjection: { omitKeys: ['content'] } },
    };
  }

  if (parsed.action === 'analyze') {
    const analysis = analyzeTextContent(parsed.content, 8);
    return {
      action: 'analyze',
      fileName: `${fileName}.pdf`,
      pageCount: 1,
      wordCount: analysis.wordCount,
      readingMinutes: analysis.readingMinutes,
      preview: analysis.preview,
      extractedText: parsed.content.slice(0, 20000),
      topWords: analysis.topWords,
      summary: `${fileName}.pdf (from chat text): ${analysis.summary}. Ready for a meeting brief.`,
      _sota: { modelProjection: { omitKeys: ['content'] } },
    };
  }

  if (parsed.editMode === 'page-range') {
    throw new InvalidToolInputError(
      'page-range needs the original PDF bytes (source file + fileId). For a chat attachment, use stamp, cover-page, or append-page and pass the full attachment text in content.',
    );
  }

  const rebuilt = await createOfficePdf({
    title: parsed.title || fileName,
    docType: parsed.docType,
    body: parsed.content,
  });
  const edited = await editOfficePdf(rebuilt, parsed.editMode, {
    text: parsed.text,
    stampPosition: parsed.stampPosition,
    title: parsed.title,
  });
  const result = finishPdf(claims, fileName, 'edit', parsed.docType, edited);
  result.summary = `Rebuilt chat PDF ${result.fileName} from visible text, then applied ${parsed.editMode}. Download the card under the message.`;
  return result;
}

function parseFileName(value: unknown, action: PdfAction): string {
  if (typeof value === 'string' && FILE_NAME_PATTERN.test(value)) {
    return value.replace(/\.pdf$/i, '');
  }
  if (action === 'create') {
    throw new InvalidToolInputError('fileName is required for create');
  }
  return 'document';
}

function parseDocType(value: unknown): OfficeDocType {
  if (value === undefined) return 'report';
  if (typeof value !== 'string' || !DOC_TYPES.includes(value as OfficeDocType)) {
    throw new InvalidToolInputError('docType must be memo, report, letter, minutes, proposal, or other');
  }
  return value as OfficeDocType;
}

function parseEditMode(value: unknown, action: PdfAction): EditMode {
  if (action !== 'edit') return 'stamp';
  if (typeof value !== 'string' || !EDIT_MODES.includes(value as EditMode)) {
    throw new InvalidToolInputError('editMode must be stamp, append-page, cover-page, or page-range');
  }
  return value as EditMode;
}

function parseStamp(value: unknown): StampPosition {
  if (value === undefined) return 'header';
  if (value !== 'header' && value !== 'footer' && value !== 'watermark') {
    throw new InvalidToolInputError('stampPosition must be header, footer, or watermark');
  }
  return value;
}

function parseSource(input: Record<string, unknown>) {
  const source = input.source;
  if (source === 'file') {
    if (typeof input.fileId !== 'string' || input.fileId.length < 8) {
      throw new InvalidToolInputError('fileId is required when source is file');
    }
    return { source: 'file' as const, fileId: input.fileId, platformFileId: '', pdfBase64: '' };
  }
  if (source === 'platform') {
    if (typeof input.platformFileId !== 'string' || input.platformFileId.length < 8) {
      throw new InvalidToolInputError('platformFileId is required when source is platform');
    }
    const pdfBase64 = typeof input.pdfBase64 === 'string' ? input.pdfBase64 : '';
    return { source: 'platform' as const, fileId: '', platformFileId: input.platformFileId, pdfBase64 };
  }
  if (source === 'base64') {
    if (typeof input.pdfBase64 !== 'string' || input.pdfBase64.length < 32) {
      throw new InvalidToolInputError('pdfBase64 is required when source is base64');
    }
    return { source: 'base64' as const, fileId: '', platformFileId: '', pdfBase64: input.pdfBase64 };
  }
  throw new InvalidToolInputError('source must be file, platform, or base64 for edit, extract, and analyze');
}

function optionalString(value: unknown, max: number, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > max) {
    throw new InvalidToolInputError(`${field} must be a string up to ${max} characters`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 200) {
    throw new InvalidToolInputError(`${field} must be an integer from 1 to 200`);
  }
  return value;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export { PlatformFileError };
