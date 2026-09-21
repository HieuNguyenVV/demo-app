import type { DrawioDiagram, DrawioDirection, DrawioNodeKind } from './drawio.js';
import { extractOutputText, openaiResponses, parseJsonObject, requireOpenAi } from './openai-client.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const DIAGRAM_TIMEOUT_MS = 20000;
const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const NODE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const KINDS = ['process', 'decision', 'start', 'end', 'data'] as const;
const DIRECTIONS = ['top-down', 'left-right'] as const;

export type DiagramPrompt = {
  baseName: string;
  title: string;
  prompt: string;
};

export function parseDiagramPrompt(input: unknown): DiagramPrompt {
  if (!isRecord(input)) {
    throw new InvalidToolInputError('input must be an object');
  }
  if (typeof input.fileName !== 'string' || !FILE_NAME_PATTERN.test(input.fileName)) {
    throw new InvalidToolInputError('fileName must use letters, numbers, dots, dashes, or underscores only');
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 80)) {
    throw new InvalidToolInputError('title must be a string up to 80 characters');
  }
  if (typeof input.prompt !== 'string') {
    throw new InvalidToolInputError('prompt must be a string describing the diagram');
  }
  const prompt = input.prompt.trim();
  if (prompt.length < 8 || prompt.length > 2000) {
    throw new InvalidToolInputError('prompt must be 8 to 2000 characters');
  }
  return {
    baseName: input.fileName.replace(/\.(drawio|txt)$/i, ''),
    title: typeof input.title === 'string' ? input.title.trim() : '',
    prompt,
  };
}

export async function designFlowchart(prompt: string, repair?: string): Promise<DrawioDiagram> {
  const data = await requestDiagramJson([
    'Design a complete flowchart. Output JSON only, no markdown.',
    'Shape: {"title":"Duyệt nghỉ phép","direction":"top-down","nodes":[{"id":"start","label":"Bắt đầu","kind":"start","x":300,"y":40},{"id":"ask","label":"Quản lý phê duyệt?","kind":"decision","x":320,"y":220}],"edges":[{"from":"start","to":"ask"},{"from":"ask","to":"hr","label":"Có"},{"from":"ask","to":"reject","label":"Không"}]}',
    'Rules:',
    '- 4 to 16 nodes, every node on a path from start to an end. No floating boxes. No dangling arrows.',
    '- kind: start (one), end (at least one), decision (diamonds), process, data.',
    '- Decision nodes MUST use kind=decision. Each decision has exactly two outgoing edges labeled Có/Không or Yes/No.',
    '- Top-down: main path shares x≈300. Yes/Có branch to the right (x≈560). Vertical gap ≥ 90. Grid 20. x,y are top-left.',
    '- Short labels, 1-6 words, Vietnamese is fine. Unique ids. edges.from/to must be node ids.',
    '- Do not invent unrelated systems.',
    '',
    `User request: ${prompt}`,
    repair ? `Fix this validation error: ${repair}` : '',
  ].filter(Boolean).join('\n'));
  return parseDesignedDiagram(data);
}

async function requestDiagramJson(input: string): Promise<Record<string, unknown>> {
  const { apiKey, model } = requireOpenAi();
  const payload = await openaiResponses(apiKey, { model, input, max_output_tokens: 4000 }, DIAGRAM_TIMEOUT_MS);
  return parseJsonObject(extractOutputText(payload));
}

function parseDesignedDiagram(data: Record<string, unknown>): DrawioDiagram {
  const title = typeof data.title === 'string' ? data.title.trim().slice(0, 80) : '';
  const direction = parseDirection(data.direction);
  const nodes = parseNodes(data.nodes);
  const edges = parseEdges(data.edges, new Set(nodes.map((node) => node.id)));
  return { title, direction, nodes, edges };
}

function parseDirection(value: unknown): DrawioDirection {
  if (value === undefined) return 'top-down';
  if (typeof value !== 'string' || !DIRECTIONS.includes(value as DrawioDirection)) {
    throw new Error('direction must be top-down or left-right');
  }
  return value as DrawioDirection;
}

function parseNodes(value: unknown): DrawioDiagram['nodes'] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) {
    throw new Error('nodes must be an array of 1 to 40 items');
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !NODE_ID_PATTERN.test(item.id)) {
      throw new Error(`nodes[${index}].id is invalid`);
    }
    if (ids.has(item.id)) {
      throw new Error(`nodes[${index}].id is duplicated`);
    }
    if (typeof item.label !== 'string' || item.label.length < 1 || item.label.length > 80) {
      throw new Error(`nodes[${index}].label must be 1 to 80 characters`);
    }
    const kind = parseKind(item.kind, index);
    ids.add(item.id);
    const x = asCoord(item.x);
    const y = asCoord(item.y);
    return { id: item.id, label: item.label.trim(), kind, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) };
  });
}

function parseKind(value: unknown, index: number): DrawioNodeKind {
  if (value === undefined) return 'process';
  if (typeof value !== 'string' || !KINDS.includes(value as DrawioNodeKind)) {
    throw new Error(`nodes[${index}].kind must be process, decision, start, end, or data`);
  }
  return value as DrawioNodeKind;
}

function parseEdges(value: unknown, nodeIds: Set<string>): DrawioDiagram['edges'] {
  if (!Array.isArray(value) || value.length > 80) {
    throw new Error('edges must be an array of up to 80 items');
  }
  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.from !== 'string' || typeof item.to !== 'string') {
      throw new Error(`edges[${index}] must include from and to`);
    }
    if (!nodeIds.has(item.from) || !nodeIds.has(item.to)) {
      throw new Error(`edges[${index}] must reference existing node ids`);
    }
    if (item.label !== undefined && (typeof item.label !== 'string' || item.label.length > 40)) {
      throw new Error(`edges[${index}].label must be a string up to 40 characters`);
    }
    return {
      from: item.from,
      to: item.to,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : undefined,
    };
  });
}

function asCoord(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(2000, Math.round(value)));
}
