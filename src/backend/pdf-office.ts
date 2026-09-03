import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont } from 'pdf-lib';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BODY_SIZE = 11;
const TITLE_SIZE = 16;
const LABEL_SIZE = 10;
const LINE_GAP = 4;

export type OfficeDocType = 'memo' | 'report' | 'letter' | 'minutes' | 'proposal' | 'other';
export type StampPosition = 'header' | 'footer' | 'watermark';
export type EditMode = 'stamp' | 'append-page' | 'cover-page' | 'page-range';

export type OfficePdfInput = {
  title: string;
  docType: OfficeDocType;
  organization?: string;
  date?: string;
  body: string;
  signer?: string;
  signerTitle?: string;
};

const DOC_LABEL: Record<OfficeDocType, string> = {
  memo: 'CÔNG VĂN / INTERNAL MEMO',
  report: 'BÁO CÁO / REPORT',
  letter: 'CÔNG VĂN GỬI / LETTER',
  minutes: 'BIÊN BẢN / MINUTES',
  proposal: 'TỜ TRÌNH / PROPOSAL',
  other: 'TÀI LIỆU / DOCUMENT',
};

export async function createOfficePdf(input: OfficePdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const { font, unicode } = await embedOfficeFont(pdf);
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const write = (text: string, size: number, options?: { boldGap?: boolean; center?: boolean }) => {
    const lines = wrapLines(font, prepareText(unicode, text), size, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      if (y < MARGIN + 40) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      const width = font.widthOfTextAtSize(line, size);
      const x = options?.center ? (PAGE_WIDTH - width) / 2 : MARGIN;
      page.drawText(line, { x, y, size, font, color: rgb(0.12, 0.14, 0.16) });
      y -= size + LINE_GAP + (options?.boldGap ? 6 : 0);
    }
  };

  if (input.organization) {
    write(input.organization, LABEL_SIZE, { center: true });
    y -= 6;
  }
  write(DOC_LABEL[input.docType], 9, { center: true });
  y -= 8;
  write(input.title, TITLE_SIZE, { center: true, boldGap: true });
  if (input.date) {
    write(`Ngày / Date: ${input.date}`, LABEL_SIZE);
    y -= 8;
  }
  write(input.body, BODY_SIZE);
  if (input.signer) {
    y -= 24;
    if (y < MARGIN + 80) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    write(input.signerTitle || 'Người ký / Signed by', LABEL_SIZE);
    y -= 28;
    write(input.signer, BODY_SIZE);
  }

  return Buffer.from(await pdf.save());
}

export async function editOfficePdf(
  source: Buffer,
  mode: EditMode,
  options: {
    text?: string;
    stampPosition?: StampPosition;
    pageStart?: number;
    pageEnd?: number;
    title?: string;
  },
): Promise<Buffer> {
  const pdf = await PDFDocument.load(source);
  pdf.registerFontkit(fontkit);
  const { font, unicode } = await embedOfficeFont(pdf);

  if (mode === 'page-range') {
    const start = Math.max(1, options.pageStart ?? 1);
    const end = Math.min(pdf.getPageCount(), options.pageEnd ?? pdf.getPageCount());
    if (start > end) {
      throw new Error('pageStart must be less than or equal to pageEnd');
    }
    const next = await PDFDocument.create();
    const pages = await next.copyPages(pdf, range(start - 1, end - 1));
    for (const copied of pages) next.addPage(copied);
    return Buffer.from(await next.save());
  }

  if (mode === 'cover-page' || mode === 'append-page') {
    const page = mode === 'cover-page'
      ? pdf.insertPage(0, [PAGE_WIDTH, PAGE_HEIGHT])
      : pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const heading = prepareText(unicode, mode === 'cover-page'
      ? (options.title || 'BÌA / COVER')
      : 'GHI CHÚ BỔ SUNG / ADDENDUM');
    page.drawText(heading, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 12, size: 14, font, color: rgb(0.12, 0.14, 0.16) });
    let y = PAGE_HEIGHT - MARGIN - 40;
    for (const line of wrapLines(font, prepareText(unicode, options.text || ''), BODY_SIZE, PAGE_WIDTH - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font, color: rgb(0.12, 0.14, 0.16) });
      y -= BODY_SIZE + LINE_GAP;
      if (y < MARGIN) break;
    }
    return Buffer.from(await pdf.save());
  }

  const stamp = prepareText(unicode, options.text?.trim() || 'BAN SAO / COPY');
  const position = options.stampPosition ?? 'header';
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    if (position === 'watermark') {
      page.drawText(stamp, {
        x: width / 4,
        y: height / 2,
        size: 28,
        font,
        rotate: degrees(32),
        color: rgb(0.72, 0.18, 0.18),
        opacity: 0.22,
      });
      continue;
    }
    const y = position === 'footer' ? 24 : height - 28;
    page.drawText(stamp, { x: MARGIN, y, size: 9, font, color: rgb(0.45, 0.12, 0.12) });
  }
  return Buffer.from(await pdf.save());
}

export async function extractPdfText(source: Buffer): Promise<{ text: string; pageCount: number }> {
  const result = await pdfParse(source);
  return {
    text: (result.text || '').trim(),
    pageCount: result.numpages || 0,
  };
}

function prepareText(hasUnicodeFont: boolean, text: string): string {
  if (hasUnicodeFont) return text;
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D');
}

async function embedOfficeFont(pdf: PDFDocument): Promise<{ font: PDFFont; unicode: boolean }> {
  const path = resolveUnicodeFont();
  if (path) {
    return { font: await pdf.embedFont(readFileSync(path)), unicode: true };
  }
  return { font: await pdf.embedFont(StandardFonts.Helvetica), unicode: false };
}

function resolveUnicodeFont(): string | undefined {
  const candidates = [
    process.env.SOTA_PDF_FONT,
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    join(process.cwd(), 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
  ];
  try {
    candidates.push(join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf/DejaVuSans.ttf'));
  } catch {
    // package layout may omit the ttf folder
  }
  return candidates.find((path): path is string => Boolean(path && existsSync(path)));
}

function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const paragraphs = text.replaceAll('\r\n', '\n').split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function range(from: number, to: number): number[] {
  const values: number[] = [];
  for (let index = from; index <= to; index += 1) values.push(index);
  return values;
}
