import {
  buildSequencePreviewSvg,
  buildSequenceSourceText,
  buildSequenceXml,
  isOpenFragment,
  isSequenceMessage,
  type SequenceMessageKind,
  type SequenceStep,
} from './sequence.js';
import { asJsonArray, InvalidToolInputError, isRecord } from './tool.shared.js';

const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const EXTENSIONS = /\.(txt|drawio)$/i;
const KINDS = ['sync', 'async', 'return', 'self'] as const;
const FRAGMENTS = ['alt', 'else', 'loop', 'opt', 'par', 'break', 'end', 'note', 'activate', 'deactivate'] as const;
const DRAWIO_MIME = 'application/vnd.jgraph.mxfile';
const TXT_MIME = 'text/plain';
const PREVIEW_CAP = 80000;

export type GenerateSequenceDiagramResult = {
  fileName: string;
  format: 'drawio';
  mimeType: string;
  contentEncoding: 'text';
  sizeBytes: number;
  txtFileName: string;
  txtMimeType: string;
  txtSizeBytes: number;
  participantCount: number;
  messageCount: number;
  summary: string;
  content: string;
  txtContent: string;
  previewSvg: string;
  _sota: {
    modelProjection: {
      omitKeys: ['content', 'txtContent', 'previewSvg'];
    };
  };
};

export function handleGenerateSequenceDiagram(input: unknown): GenerateSequenceDiagramResult {
  const parsed = parseInput(input);
  const content = buildSequenceXml(parsed);
  const txtContent = buildSequenceSourceText(parsed);
  const preview = buildSequencePreviewSvg(parsed);
  const fileName = `${parsed.baseName}.drawio`;
  const txtFileName = `${parsed.baseName}.txt`;
  const previewSvg = preview.length <= PREVIEW_CAP ? preview : '';
  const messageCount = parsed.messages.filter(isSequenceMessage).length;

  return {
    fileName,
    format: 'drawio',
    mimeType: DRAWIO_MIME,
    contentEncoding: 'text',
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    txtFileName,
    txtMimeType: TXT_MIME,
    txtSizeBytes: Buffer.byteLength(txtContent, 'utf8'),
    participantCount: parsed.participants.length,
    messageCount,
    summary: `Generated ${fileName} and ${txtFileName} with ${parsed.participants.length} participants and ${messageCount} messages. Open the .drawio in diagrams.net; paste the .txt into sequencediagram.org.`,
    content,
    txtContent,
    previewSvg,
    _sota: {
      modelProjection: {
        omitKeys: ['content', 'txtContent', 'previewSvg'],
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
  const messages = parseSteps(asJsonArray(input.messages, 'messages'), new Set(participants.map((item) => item.id)));

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

function parseSteps(value: unknown[], participantIds: Set<string>): SequenceStep[] {
  if (value.length < 1 || value.length > 64) {
    throw new InvalidToolInputError('messages must be an array of 1 to 64 items');
  }

  const steps = value.map((item, index) => parseStep(item, index, participantIds));
  if (!steps.some(isSequenceMessage)) {
    throw new InvalidToolInputError('messages must include at least one call (from/to)');
  }
  validateFragments(steps);
  return steps;
}

function parseStep(item: unknown, index: number, participantIds: Set<string>): SequenceStep {
  if (!isRecord(item)) {
    throw new InvalidToolInputError(`messages[${index}] must be an object`);
  }

  const type = typeof item.type === 'string' ? item.type : undefined;
  if (type && FRAGMENTS.includes(type as (typeof FRAGMENTS)[number])) {
    return parseFragment(item, index, type as (typeof FRAGMENTS)[number], participantIds);
  }

  if (typeof item.from !== 'string' || typeof item.to !== 'string') {
    throw new InvalidToolInputError(`messages[${index}] must include from and to, or a fragment type`);
  }
  if (!participantIds.has(item.from) || !participantIds.has(item.to)) {
    throw new InvalidToolInputError(`messages[${index}] must reference existing participant ids`);
  }
  if (item.label !== undefined && (typeof item.label !== 'string' || item.label.length > 48)) {
    throw new InvalidToolInputError(`messages[${index}].label must be a string up to 48 characters`);
  }
  return {
    type: 'message',
    from: item.from,
    to: item.to,
    label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : undefined,
    kind: parseKind(item.kind, index, item.from === item.to),
  };
}

function parseFragment(
  item: Record<string, unknown>,
  index: number,
  type: (typeof FRAGMENTS)[number],
  participantIds: Set<string>,
): SequenceStep {
  if (item.label !== undefined && (typeof item.label !== 'string' || item.label.length > 48)) {
    throw new InvalidToolInputError(`messages[${index}].label must be a string up to 48 characters`);
  }
  const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : undefined;
  const from = typeof item.from === 'string' ? item.from : undefined;
  const to = typeof item.to === 'string' ? item.to : undefined;

  if (type === 'note') {
    if (!from || !participantIds.has(from)) {
      throw new InvalidToolInputError(`messages[${index}] note needs from as a participant id`);
    }
    const dest = to ?? from;
    if (!participantIds.has(dest)) {
      throw new InvalidToolInputError(`messages[${index}] note.to must be a participant id`);
    }
    if (!label) {
      throw new InvalidToolInputError(`messages[${index}] note needs a label`);
    }
    return { type, from, to: dest, label };
  }

  if (type === 'activate' || type === 'deactivate') {
    if (!from || !participantIds.has(from)) {
      throw new InvalidToolInputError(`messages[${index}] ${type} needs from as a participant id`);
    }
    return { type, from };
  }

  return { type, label };
}

function validateFragments(steps: SequenceStep[]) {
  const stack: Array<'alt' | 'loop' | 'opt' | 'par' | 'break'> = [];
  for (const [index, step] of steps.entries()) {
    if (isOpenFragment(step.type)) {
      if (stack.length >= 2) {
        throw new InvalidToolInputError(`messages[${index}] nested fragments cannot go deeper than 2`);
      }
      stack.push(step.type);
      continue;
    }
    if (step.type === 'else') {
      const open = stack[stack.length - 1];
      if (open !== 'alt' && open !== 'par') {
        throw new InvalidToolInputError(`messages[${index}] else is only allowed inside alt or par`);
      }
      continue;
    }
    if (step.type === 'end') {
      if (stack.length === 0) {
        throw new InvalidToolInputError(`messages[${index}] end has no matching alt/loop/opt/par/break`);
      }
      stack.pop();
    }
  }
  if (stack.length > 0) {
    throw new InvalidToolInputError(`messages is missing ${stack.length} end marker(s) for ${stack.join(', ')}`);
  }
}

function parseKind(value: unknown, index: number, isSelf: boolean): SequenceMessageKind {
  if (isSelf) return 'self';
  if (value === undefined) return 'sync';
  if (typeof value !== 'string' || !KINDS.includes(value as SequenceMessageKind)) {
    throw new InvalidToolInputError(`messages[${index}].kind must be sync, async, return, or self`);
  }
  return value as SequenceMessageKind;
}
