import { buildSequencePreviewSvg, buildSequenceXml, type SequenceMessageKind } from './sequence.js';
import { asJsonArray, InvalidToolInputError, isRecord } from './tool.shared.js';

const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const EXTENSIONS = /\.drawio$/i;
const KINDS = ['sync', 'async', 'return', 'self'] as const;
const MIME_TYPE = 'application/vnd.jgraph.mxfile';
const PREVIEW_CAP = 80000;

export type GenerateSequenceDiagramResult = {
  fileName: string;
  format: 'drawio';
  mimeType: string;
  contentEncoding: 'text';
  sizeBytes: number;
  participantCount: number;
  messageCount: number;
  summary: string;
  content: string;
  previewSvg: string;
  _sota: {
    modelProjection: {
      omitKeys: ['content', 'previewSvg'];
    };
  };
};

export function handleGenerateSequenceDiagram(input: unknown): GenerateSequenceDiagramResult {
  const parsed = parseInput(input);
  const content = buildSequenceXml(parsed);
  const preview = buildSequencePreviewSvg(parsed);
  const fileName = `${parsed.baseName}.drawio`;
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  const previewSvg = preview.length <= PREVIEW_CAP ? preview : '';

  return {
    fileName,
    format: 'drawio',
    mimeType: MIME_TYPE,
    contentEncoding: 'text',
    sizeBytes,
    participantCount: parsed.participants.length,
    messageCount: parsed.messages.length,
    summary: `Generated ${fileName} with ${parsed.participants.length} participants and ${parsed.messages.length} messages. Open in diagrams.net / draw.io.`,
    content,
    previewSvg,
    _sota: {
      modelProjection: {
        omitKeys: ['content', 'previewSvg'],
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

  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 80)) {
    throw new InvalidToolInputError('title must be a string up to 80 characters');
  }

  const participants = parseParticipants(asJsonArray(input.participants, 'participants'));
  const messages = parseMessages(asJsonArray(input.messages, 'messages'), new Set(participants.map((item) => item.id)));

  return {
    baseName: input.fileName.replace(EXTENSIONS, ''),
    title: typeof input.title === 'string' ? input.title.trim() : '',
    participants,
    messages,
  };
}

function parseParticipants(value: unknown[]) {
  if (value.length < 2 || value.length > 12) {
    throw new InvalidToolInputError('participants must be an array of 2 to 12 items');
  }

  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) {
      throw new InvalidToolInputError(`participants[${index}].id is invalid`);
    }
    if (ids.has(item.id)) {
      throw new InvalidToolInputError(`participants[${index}].id "${item.id}" is duplicated`);
    }
    if (typeof item.label !== 'string' || item.label.length < 1 || item.label.length > 40) {
      throw new InvalidToolInputError(`participants[${index}].label must be 1 to 40 characters`);
    }
    ids.add(item.id);
    return { id: item.id, label: item.label.trim() };
  });
}

function parseMessages(value: unknown[], participantIds: Set<string>) {
  if (value.length < 1 || value.length > 40) {
    throw new InvalidToolInputError('messages must be an array of 1 to 40 items');
  }

  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.from !== 'string' || typeof item.to !== 'string') {
      throw new InvalidToolInputError(`messages[${index}] must include from and to`);
    }
    if (!participantIds.has(item.from) || !participantIds.has(item.to)) {
      throw new InvalidToolInputError(`messages[${index}] must reference existing participant ids`);
    }
    if (item.label !== undefined && (typeof item.label !== 'string' || item.label.length > 48)) {
      throw new InvalidToolInputError(`messages[${index}].label must be a string up to 48 characters`);
    }
    const kind = parseKind(item.kind, index, item.from === item.to);
    return {
      from: item.from,
      to: item.to,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : undefined,
      kind,
    };
  });
}

function parseKind(value: unknown, index: number, isSelf: boolean): SequenceMessageKind {
  if (isSelf) return 'self';
  if (value === undefined) return 'sync';
  if (typeof value !== 'string' || !KINDS.includes(value as SequenceMessageKind)) {
    throw new InvalidToolInputError(`messages[${index}].kind must be sync, async, return, or self`);
  }
  return value as SequenceMessageKind;
}
