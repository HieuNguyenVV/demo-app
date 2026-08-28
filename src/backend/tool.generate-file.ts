import PDFDocument from 'pdfkit';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const MAX_CONTENT_LENGTH = 20000;
const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const FORMATS = ['txt', 'md', 'json', 'csv', 'pdf'] as const;
const EXTENSIONS = /\.(txt|md|json|csv|pdf)$/i;

type OutputFormat = (typeof FORMATS)[number];
type ContentEncoding = 'text' | 'base64';

const MIME_TYPES: Record<OutputFormat, string> = {
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  json: 'application/json;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  pdf: 'application/pdf',
};

export type GenerateFileResult = {
  fileName: string;
  format: OutputFormat;
  mimeType: string;
  contentEncoding: ContentEncoding;
  sizeBytes: number;
  lineCount: number;
  summary: string;
  content: string;
  _sota: {
    modelProjection: {
      omitKeys: ['content'];
    };
  };
};

export async function handleGenerateFile(input: unknown): Promise<GenerateFileResult> {
  const parsed = parseInput(input);
  const built = await buildFile(parsed);
  const fileName = `${parsed.baseName}.${parsed.format}`;

  return {
    fileName,
    format: parsed.format,
    mimeType: MIME_TYPES[parsed.format],
    contentEncoding: built.encoding,
    sizeBytes: built.sizeBytes,
    lineCount: built.lineCount,
    summary: `Generated ${fileName} (${formatSize(built.sizeBytes)}, ${built.lineCount} lines).`,
    content: built.content,
    _sota: {
      modelProjection: {
        omitKeys: ['content'],
      },
    },
  };
}

function parseInput(input: unknown) {
  if (!isRecord(input)) {
    throw new InvalidToolInputError('input must be an object');
  }

  if (typeof input.fileName !== 'string' || !FILE_NAME_PATTERN.test(input.fileName)) {
    throw new InvalidToolInputError('fileName must use letters, numbers, dots, dashes, or underscores only');
  }

  if (typeof input.format !== 'string' || !FORMATS.includes(input.format as OutputFormat)) {
    throw new InvalidToolInputError('format must be txt, md, json, csv, or pdf');
  }

  if (typeof input.content !== 'string' || input.content.length < 1 || input.content.length > MAX_CONTENT_LENGTH) {
    throw new InvalidToolInputError(`content must be between 1 and ${MAX_CONTENT_LENGTH} characters`);
  }

  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 120)) {
    throw new InvalidToolInputError('title must be a string up to 120 characters');
  }

  const format = input.format as OutputFormat;
  if (format === 'json') {
    try {
      JSON.parse(input.content);
    } catch {
      throw new InvalidToolInputError('content must be valid JSON when format is json');
    }
  }

  if (format === 'csv') {
    validateCsv(input.content);
  }

  return {
    baseName: input.fileName.replace(EXTENSIONS, ''),
    format,
    content: input.content,
    title: typeof input.title === 'string' ? input.title.trim() : '',
  };
}

async function buildFile(input: {
  format: OutputFormat;
  content: string;
  title: string;
}) {
  if (input.format === 'pdf') {
    const buffer = await renderPdf(input.content, input.title);
    return {
      encoding: 'base64' as const,
      content: buffer.toString('base64'),
      sizeBytes: buffer.byteLength,
      lineCount: countLines(input.content),
    };
  }

  const content = input.format === 'md' && input.title && !input.content.startsWith('#')
    ? `# ${input.title}\n\n${input.content}`
    : input.content;

  return {
    encoding: 'text' as const,
    content,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    lineCount: countLines(content),
  };
}

function validateCsv(content: string) {
  const lines = content.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new InvalidToolInputError('csv content must include at least one row');
  }

  const columnCount = lines[0].split(',').length;
  if (columnCount < 1) {
    throw new InvalidToolInputError('csv must include at least one column');
  }

  for (const [index, line] of lines.entries()) {
    if (line.split(',').length !== columnCount) {
      throw new InvalidToolInputError(`csv row ${index + 1} must have ${columnCount} columns`);
    }
  }
}

function renderPdf(content: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (title) {
      doc.fontSize(18).text(title);
      doc.moveDown();
    }

    doc.fontSize(12).text(content, {
      align: 'left',
      lineGap: 4,
    });
    doc.end();
  });
}

function countLines(content: string): number {
  return content.split(/\r\n|\n|\r/).length;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
