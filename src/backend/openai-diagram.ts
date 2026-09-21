import { extractOutputText, openaiResponses, parseJsonObject, requireOpenAi } from './openai-client.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';

const DIAGRAM_TIMEOUT_MS = 25000;
const FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export type DiagramPrompt = {
  baseName: string;
  title: string;
  prompt: string;
};

export type OpenAiFlowchart = {
  title: string;
  svg: string;
  nodeCount: number;
  edgeCount: number;
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

export async function drawFlowchartSvg(prompt: string, repair?: string): Promise<OpenAiFlowchart> {
  const data = await requestDiagramJson([
    'Draw a polished flowchart as a self-contained SVG. Output JSON only.',
    'Shape: {"title":"string","svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 1100 900\\">...</svg>","nodeCount":8,"edgeCount":9}',
    'Visual rules:',
    '- Generous spacing (at least 48px between shapes). Align on a grid. No overlapping boxes or labels.',
    '- White background. Rounded process boxes, stadium start/end, diamond decisions, parallelogram data.',
    '- Colors: process #DAE8FC/#6C8EBF, decision #FFF2CC/#D6B656, start #D5E8D4/#82B366, end #F8CECC/#B85450, data #E1D5E7/#9673A6.',
    '- Orthogonal connectors with arrowheads. Label yes/no on decision branches.',
    '- font-family: "Segoe UI", Helvetica, sans-serif. Labels 1-6 words. Vietnamese is fine.',
    '- Inline attributes only (no CSS classes, no images, no script). Keep SVG under 60KB.',
    '- Include width, height, and viewBox on <svg>. Draw the full diagram the user asked for.',
    '',
    `User request: ${prompt}`,
    repair ? `Fix this problem: ${repair}` : '',
  ].filter(Boolean).join('\n'));
  const svg = sanitizeSvg(asString(data.svg, 'svg'));
  return {
    title: asString(data.title, 'title').slice(0, 80) || 'Flowchart',
    svg,
    nodeCount: Math.max(1, asCount(data.nodeCount) || countTags(svg, 'rect|ellipse|circle|polygon')),
    edgeCount: Math.max(0, asCount(data.edgeCount) || countTags(svg, 'path|line|polyline')),
  };
}

async function requestDiagramJson(input: string): Promise<Record<string, unknown>> {
  const { apiKey, model } = requireOpenAi();
  const payload = await openaiResponses(apiKey, { model, input, max_output_tokens: 16000 }, DIAGRAM_TIMEOUT_MS);
  return parseJsonObject(extractOutputText(payload));
}

export function sanitizeSvg(raw: string): string {
  const match = raw.match(/<svg\b[\s\S]*<\/svg>/i);
  if (!match) {
    throw new Error('OpenAI did not return an SVG diagram');
  }
  let svg = match[0]
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
  if (!/\sxmlns=/.test(svg.slice(0, 280))) {
    svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (svg.length < 80) {
    throw new Error('OpenAI SVG is empty');
  }
  if (svg.length > 70000) {
    throw new Error('OpenAI SVG is too large');
  }
  return svg;
}

export function wrapSvgAsDrawio(svg: string, title: string): string {
  const { width, height } = readSvgSize(svg);
  const href = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  const page = escapeXml(title || 'Page-1');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="Inkline" type="device">',
    `  <diagram name="${page}" id="page-1">`,
    `    <mxGraphModel dx="${width}" dy="${height}" grid="1" gridSize="10" guides="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}">`,
    '      <root>',
    '        <mxCell id="0"/>',
    '        <mxCell id="1" parent="0"/>',
    `        <mxCell id="diagram" value="" style="shape=image;html=1;imageAspect=0;aspect=fixed;image=${escapeXml(href)}" vertex="1" parent="1">`,
    `          <mxGeometry width="${width}" height="${height}" as="geometry"/>`,
    '        </mxCell>',
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    '',
  ].join('\n');
}

function readSvgSize(svg: string): { width: number; height: number } {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const viewBox = /viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i.exec(open);
  const width = numberAttr(open, 'width') ?? (viewBox ? Number(viewBox[1]) : 1100);
  const height = numberAttr(open, 'height') ?? (viewBox ? Number(viewBox[2]) : 800);
  return {
    width: clamp(Math.round(width), 400, 2400),
    height: clamp(Math.round(height), 300, 2400),
  };
}

function numberAttr(open: string, name: string): number | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*["']([\\d.]+)`, 'i').exec(open);
  return match ? Number(match[1]) : undefined;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`OpenAI JSON is missing ${field}`);
  }
  return value.trim();
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function countTags(svg: string, names: string): number {
  return (svg.match(new RegExp(`<(?:${names})\\b`, 'gi')) ?? []).length;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
