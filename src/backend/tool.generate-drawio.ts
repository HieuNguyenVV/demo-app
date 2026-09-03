import { buildDrawioXml, type DrawioDirection, type DrawioNodeKind } from './drawio.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const NODE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const EXTENSIONS = /\.drawio$/i;
const KINDS = ['process', 'decision', 'start', 'end', 'data'] as const;
const DIRECTIONS = ['top-down', 'left-right'] as const;
const MIME_TYPE = 'application/vnd.jgraph.mxfile';

export type GenerateDrawioResult = {
  fileName: string;
  format: 'drawio';
  mimeType: string;
  contentEncoding: 'text';
  sizeBytes: number;
  nodeCount: number;
  edgeCount: number;
  summary: string;
  content: string;
  _sota: {
    modelProjection: {
      omitKeys: ['content'];
    };
  };
};

export function handleGenerateDrawio(input: unknown): GenerateDrawioResult {
  const parsed = parseInput(input);
  const content = buildDrawioXml(parsed);
  const fileName = `${parsed.baseName}.drawio`;
  const sizeBytes = Buffer.byteLength(content, 'utf8');

  return {
    fileName,
    format: 'drawio',
    mimeType: MIME_TYPE,
    contentEncoding: 'text',
    sizeBytes,
    nodeCount: parsed.nodes.length,
    edgeCount: parsed.edges.length,
    summary: `Generated ${fileName} with ${parsed.nodes.length} shapes and ${parsed.edges.length} connectors. Open in diagrams.net / draw.io.`,
    content,
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

  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 80)) {
    throw new InvalidToolInputError('title must be a string up to 80 characters');
  }

  const direction = parseDirection(input.direction);
  const nodes = parseNodes(input.nodes);
  const edges = parseEdges(input.edges, new Set(nodes.map((node) => node.id)));

  return {
    baseName: input.fileName.replace(EXTENSIONS, ''),
    title: typeof input.title === 'string' ? input.title.trim() : '',
    direction,
    nodes,
    edges,
  };
}

function parseDirection(value: unknown): DrawioDirection {
  if (value === undefined) return 'top-down';
  if (typeof value !== 'string' || !DIRECTIONS.includes(value as DrawioDirection)) {
    throw new InvalidToolInputError('direction must be top-down or left-right');
  }
  return value as DrawioDirection;
}

function parseNodes(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) {
    throw new InvalidToolInputError('nodes must be an array of 1 to 40 items');
  }

  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !NODE_ID_PATTERN.test(item.id)) {
      throw new InvalidToolInputError(`nodes[${index}].id is invalid`);
    }
    if (ids.has(item.id)) {
      throw new InvalidToolInputError(`nodes[${index}].id "${item.id}" is duplicated`);
    }
    if (typeof item.label !== 'string' || item.label.length < 1 || item.label.length > 80) {
      throw new InvalidToolInputError(`nodes[${index}].label must be 1 to 80 characters`);
    }
    const kind = parseKind(item.kind, index);
    ids.add(item.id);
    return { id: item.id, label: item.label, kind };
  });
}

function parseKind(value: unknown, index: number): DrawioNodeKind {
  if (value === undefined) return 'process';
  if (typeof value !== 'string' || !KINDS.includes(value as DrawioNodeKind)) {
    throw new InvalidToolInputError(`nodes[${index}].kind must be process, decision, start, end, or data`);
  }
  return value as DrawioNodeKind;
}

function parseEdges(value: unknown, nodeIds: Set<string>) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 80) {
    throw new InvalidToolInputError('edges must be an array of up to 80 items');
  }

  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.from !== 'string' || typeof item.to !== 'string') {
      throw new InvalidToolInputError(`edges[${index}] must include from and to`);
    }
    if (!nodeIds.has(item.from) || !nodeIds.has(item.to)) {
      throw new InvalidToolInputError(`edges[${index}] must reference existing node ids`);
    }
    if (item.label !== undefined && (typeof item.label !== 'string' || item.label.length > 40)) {
      throw new InvalidToolInputError(`edges[${index}].label must be a string up to 40 characters`);
    }
    return {
      from: item.from,
      to: item.to,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : undefined,
    };
  });
}
