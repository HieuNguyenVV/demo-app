import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type MeetingActionItem = {
  text: string;
  owner?: string;
  dueHint?: string;
};

export type MeetingDocxPayload = {
  docFileName: string;
  docMimeType: string;
  docContentEncoding: 'base64';
  docSizeBytes: number;
  docContent: string;
};

type MinutesDocInput = {
  title: string;
  meetingDate: string;
  attendees: string[];
  agenda: string[];
  discussionPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  nextSteps: string[];
};

export async function buildMeetingDocx(input: MinutesDocInput): Promise<MeetingDocxPayload> {
  const children: Paragraph[] = [
    new Paragraph({ text: input.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${input.meetingDate}`, bold: true })],
    }),
    new Paragraph({ text: '' }),
  ];

  appendBulletSection(children, 'Attendees', input.attendees);
  appendBulletSection(children, 'Agenda', input.agenda);
  appendBulletSection(children, 'Discussion', input.discussionPoints);
  appendBulletSection(children, 'Decisions', input.decisions);
  appendActionItems(children, input.actionItems);
  appendBulletSection(children, 'Next steps', input.nextSteps);

  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));

  return {
    docFileName: toDocFileName(input.title),
    docMimeType: DOCX_MIME,
    docContentEncoding: 'base64',
    docSizeBytes: buffer.byteLength,
    docContent: buffer.toString('base64'),
  };
}

function appendBulletSection(children: Paragraph[], title: string, items: string[]) {
  if (items.length === 0) return;
  children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
  for (const item of items) {
    children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
  }
  children.push(new Paragraph({ text: '' }));
}

function appendActionItems(children: Paragraph[], items: MeetingActionItem[]) {
  if (items.length === 0) return;
  children.push(new Paragraph({ text: 'Action items', heading: HeadingLevel.HEADING_2 }));
  for (const item of items) {
    const suffix = [
      item.owner ? `Owner: ${item.owner}` : '',
      item.dueHint ? `Due: ${item.dueHint}` : '',
    ].filter(Boolean).join(' · ');

    children.push(new Paragraph({
      children: [
        new TextRun({ text: item.text }),
        ...(suffix ? [new TextRun({ text: ` (${suffix})`, italics: true })] : []),
      ],
      bullet: { level: 0 },
    }));
  }
  children.push(new Paragraph({ text: '' }));
}

function toDocFileName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'meeting-minutes'}.docx`;
}
