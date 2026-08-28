import { readUploadedFile } from './file-store.js';
import { buildMeetingDocx } from './meeting-docx.js';
import type { InvocationClaims } from './sota-auth.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const MAX_TEXT_LENGTH = 20000;
const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECTION_HEADERS: Record<SectionKey, RegExp> = {
  attendees: /^(?:attendees|participants|present|people|thành phần|tham dự|có mặt)\s*:?\s*$/i,
  agenda: /^(?:agenda|topics|subject|chủ đề|chương trình)\s*:?\s*$/i,
  discussion: /^(?:discussion|notes|summary|thảo luận|nội dung|ghi chú|tóm tắt)\s*:?\s*$/i,
  decisions: /^(?:decisions|decided|quyết định|kết luận)\s*:?\s*$/i,
  actionItems: /^(?:action items?|actions?|todos?|tasks?|việc cần làm|công việc|hành động)\s*:?\s*$/i,
  nextSteps: /^(?:next steps?|follow[- ]?up|bước tiếp theo|hẹn|tiếp theo)\s*:?\s*$/i,
};

const MARKDOWN_HEADER = /^#{1,3}\s+(.+)$/;
const BULLET_LINE = /^\s*(?:[-*+•]|\d+[.)])\s+(.+)$/;
const DATE_LINE = /^(?:date|ngày|meeting date)\s*:\s*(.+)$/i;
const INLINE_DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/;

type SectionKey =
  | 'attendees'
  | 'agenda'
  | 'discussion'
  | 'decisions'
  | 'actionItems'
  | 'nextSteps';

export type MeetingActionItem = {
  text: string;
  owner?: string;
  dueHint?: string;
};

export type MeetingMinutesResult = {
  source: 'text' | 'file';
  fileId?: string;
  fileName?: string;
  title: string;
  meetingDate: string;
  attendeeCount: number;
  decisionCount: number;
  actionItemCount: number;
  summary: string;
  attendees: string[];
  agenda: string[];
  discussionPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  nextSteps: string[];
  formattedMinutes: string;
  docFileName: string;
  docMimeType: string;
  docContentEncoding: 'base64';
  docSizeBytes: number;
  docContent: string;
  _sota: {
    modelProjection: {
      omitKeys: ['docContent', 'formattedMinutes'];
    };
  };
};

export async function handleMeetingMinutes(input: unknown, claims: InvocationClaims): Promise<MeetingMinutesResult> {
  const parsed = parseInput(input, claims);
  const sections = parseSections(parsed.content);
  const title = typeof parsed.title === 'string' && parsed.title.trim()
    ? parsed.title.trim()
    : inferTitle(parsed.content);
  const meetingDate = parsed.meetingDate ?? sections.detectedDate ?? new Date().toISOString().slice(0, 10);
  const actionItems = sections.actionItems.map(parseActionItem);

  const formattedMinutes = formatMinutesMarkdown({
    title,
    meetingDate,
    attendees: sections.attendees,
    agenda: sections.agenda,
    discussionPoints: sections.discussionPoints,
    decisions: sections.decisions,
    actionItems,
    nextSteps: sections.nextSteps,
  });

  const summary = [
    `${sections.attendees.length} attendee${sections.attendees.length === 1 ? '' : 's'}`,
    `${sections.decisions.length} decision${sections.decisions.length === 1 ? '' : 's'}`,
    `${actionItems.length} action item${actionItems.length === 1 ? '' : 's'}`,
  ].join(', ');

  const doc = await buildMeetingDocx({
    title,
    meetingDate,
    attendees: sections.attendees,
    agenda: sections.agenda,
    discussionPoints: sections.discussionPoints,
    decisions: sections.decisions,
    actionItems,
    nextSteps: sections.nextSteps,
  });

  return {
    source: parsed.source,
    ...(parsed.source === 'file' ? { fileId: parsed.fileId, fileName: parsed.fileName } : {}),
    title,
    meetingDate,
    attendeeCount: sections.attendees.length,
    decisionCount: sections.decisions.length,
    actionItemCount: actionItems.length,
    summary: `${summary}. Word document ready as ${doc.docFileName}.`,
    attendees: sections.attendees,
    agenda: sections.agenda,
    discussionPoints: sections.discussionPoints,
    decisions: sections.decisions,
    actionItems,
    nextSteps: sections.nextSteps,
    formattedMinutes,
    ...doc,
    _sota: {
      modelProjection: {
        omitKeys: ['docContent', 'formattedMinutes'],
      },
    },
  };
}

function parseInput(input: unknown, claims: InvocationClaims) {
  if (!isRecord(input) || (input.source !== 'text' && input.source !== 'file')) {
    throw new InvalidToolInputError('source must be "text" or "file"');
  }

  const title = typeof input.title === 'string' ? input.title : undefined;
  const meetingDate = typeof input.meetingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.meetingDate)
    ? input.meetingDate
    : undefined;

  if (input.source === 'file') {
    if (typeof input.fileId !== 'string' || !FILE_ID_PATTERN.test(input.fileId)) {
      throw new InvalidToolInputError('fileId must be a valid app file id when source is file');
    }
    const { record, content } = readUploadedFile(claims, input.fileId);
    if (content.length > MAX_TEXT_LENGTH) {
      throw new InvalidToolInputError(`file content must be at most ${MAX_TEXT_LENGTH} characters`);
    }
    return {
      source: 'file' as const,
      fileId: input.fileId,
      fileName: record.fileName,
      content,
      title,
      meetingDate,
    };
  }

  if (typeof input.text !== 'string' || input.text.length < 1 || input.text.length > MAX_TEXT_LENGTH) {
    throw new InvalidToolInputError(`text must be between 1 and ${MAX_TEXT_LENGTH} characters`);
  }

  return {
    source: 'text' as const,
    content: input.text,
    title,
    meetingDate,
  };
}

type ParsedSections = {
  detectedDate?: string;
  attendees: string[];
  agenda: string[];
  discussionPoints: string[];
  decisions: string[];
  actionItems: string[];
  nextSteps: string[];
};

function parseSections(content: string): ParsedSections {
  const lines = content.split(/\r\n|\n|\r/);
  const sections: ParsedSections = {
    attendees: [],
    agenda: [],
    discussionPoints: [],
    decisions: [],
    actionItems: [],
    nextSteps: [],
  };

  let current: SectionKey | 'discussion' = 'discussion';
  let detectedDate: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const dateMatch = DATE_LINE.exec(line);
    if (dateMatch) {
      detectedDate = normalizeDate(dateMatch[1].trim());
      continue;
    }

    if (!detectedDate) {
      const inlineDate = INLINE_DATE.exec(line);
      if (inlineDate) detectedDate = normalizeDate(inlineDate[1]);
    }

    const markdownHeader = MARKDOWN_HEADER.exec(line);
    if (markdownHeader) {
      const section = matchSectionHeader(markdownHeader[1].trim());
      if (section) {
        current = section;
        continue;
      }
    }

    const section = matchSectionHeader(line.replace(/:$/, ''));
    if (section) {
      current = section;
      continue;
    }

    const bullet = BULLET_LINE.exec(rawLine);
    const value = bullet ? bullet[1].trim() : line;

    if (current === 'attendees') {
      sections.attendees.push(...splitInlineList(value));
      continue;
    }

    if (current === 'discussion') {
      sections.discussionPoints.push(value);
      continue;
    }

    sections[current].push(value);
  }

  return { ...sections, detectedDate };
}

function matchSectionHeader(label: string): SectionKey | undefined {
  for (const [key, pattern] of Object.entries(SECTION_HEADERS) as Array<[SectionKey, RegExp]>) {
    if (pattern.test(label)) return key;
  }
  return undefined;
}

function splitInlineList(value: string): string[] {
  return value
    .split(/[,;|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseActionItem(line: string): MeetingActionItem {
  const ownerMatch = line.match(/(?:@([A-Za-z0-9._-]+)|\(([A-Za-z][A-Za-z0-9 .'-]{1,40})\)|(?:owner|người phụ trách)\s*:\s*([A-Za-z][A-Za-z0-9 .'-]{1,40}))/i);
  const dueMatch = line.match(/\b(?:due|deadline|hạn|trước)\s*:\s*([^\n]+)$/i)
    || line.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);

  const owner = ownerMatch?.[1] ?? ownerMatch?.[2] ?? ownerMatch?.[3];
  let text = line
    .replace(/(?:@([A-Za-z0-9._-]+)|\(([A-Za-z][A-Za-z0-9 .'-]{1,40})\)|(?:owner|người phụ trách)\s*:\s*[A-Za-z][A-Za-z0-9 .'-]{1,40})/gi, '')
    .replace(/\b(?:due|deadline|hạn|trước)\s*:\s*[^\n]+$/i, '')
    .replace(/\s[-–—]\s*$/, '')
    .trim();

  return {
    text,
    ...(owner ? { owner: owner.trim() } : {}),
    ...(dueMatch ? { dueHint: dueMatch[1].trim() } : {}),
  };
}

function inferTitle(content: string): string {
  const firstLine = content.split(/\r\n|\n|\r/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return 'Meeting minutes';
  if (MARKDOWN_HEADER.test(firstLine)) {
    return firstLine.replace(/^#{1,3}\s+/, '').trim();
  }
  if (firstLine.length <= 80 && !BULLET_LINE.test(firstLine)) {
    return firstLine.replace(/:$/, '');
  }
  return 'Meeting minutes';
}

function normalizeDate(value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.split(/[/.-]/).map((part) => part.trim());
  if (parts.length !== 3) return undefined;
  let [a, b, c] = parts;
  if (c.length === 2) c = `20${c}`;
  if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
  return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
}

function formatMinutesMarkdown(input: {
  title: string;
  meetingDate: string;
  attendees: string[];
  agenda: string[];
  discussionPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  nextSteps: string[];
}): string {
  const blocks: string[] = [
    `# ${input.title}`,
    '',
    `**Date:** ${input.meetingDate}`,
    '',
  ];

  appendSection(blocks, 'Attendees', input.attendees.map((name) => `- ${name}`));
  appendSection(blocks, 'Agenda', input.agenda.map((item) => `- ${item}`));
  appendSection(blocks, 'Discussion', input.discussionPoints.map((item) => `- ${item}`));
  appendSection(blocks, 'Decisions', input.decisions.map((item) => `- ${item}`));
  appendSection(
    blocks,
    'Action items',
    input.actionItems.map((item) => {
      const owner = item.owner ? ` (${item.owner})` : '';
      const due = item.dueHint ? ` — due ${item.dueHint}` : '';
      return `- ${item.text}${owner}${due}`;
    }),
  );
  appendSection(blocks, 'Next steps', input.nextSteps.map((item) => `- ${item}`));

  return blocks.join('\n').trim();
}

function appendSection(blocks: string[], title: string, lines: string[]) {
  if (lines.length === 0) return;
  blocks.push(`## ${title}`, '', ...lines, '');
}
