export type DrawioNodeKind = 'process' | 'decision' | 'start' | 'end' | 'data';
export type DrawioDirection = 'top-down' | 'left-right';

export type DrawioNode = {
  id: string;
  label: string;
  kind: DrawioNodeKind;
};

export type DrawioEdge = {
  from: string;
  to: string;
  label?: string;
};

export type DrawioDiagram = {
  title: string;
  direction: DrawioDirection;
  nodes: DrawioNode[];
  edges: DrawioEdge[];
};

type Size = { width: number; height: number };
type Point = { x: number; y: number };
type PlacedNode = DrawioNode & Point & Size;

const FONT = 'Helvetica';
const GAP = 56;
const MARGIN = 48;
const TITLE_HEIGHT = 44;
const GRID = 10;

const KIND_SIZE: Record<DrawioNodeKind, Size> = {
  process: { width: 180, height: 68 },
  decision: { width: 140, height: 140 },
  start: { width: 150, height: 52 },
  end: { width: 150, height: 52 },
  data: { width: 170, height: 64 },
};

const NODE_STYLES: Record<DrawioNodeKind, string> = {
  process: styleParts({
    rounded: 1,
    arcSize: 14,
    fillColor: '#DAE8FC',
    strokeColor: '#6C8EBF',
    fontColor: '#1A365D',
    fontSize: 12,
    spacing: 10,
  }),
  decision: `rhombus;${styleParts({
    fillColor: '#FFF2CC',
    strokeColor: '#D6B656',
    fontColor: '#744210',
    fontSize: 11,
    spacing: 8,
  })}`,
  start: styleParts({
    rounded: 1,
    arcSize: 50,
    fillColor: '#D5E8D4',
    strokeColor: '#82B366',
    fontColor: '#276749',
    fontSize: 12,
    spacing: 8,
  }),
  end: styleParts({
    rounded: 1,
    arcSize: 50,
    fillColor: '#F8CECC',
    strokeColor: '#B85450',
    fontColor: '#9B2C2C',
    fontSize: 12,
    spacing: 8,
  }),
  data: `shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;${styleParts({
    fillColor: '#E1D5E7',
    strokeColor: '#9673A6',
    fontColor: '#553C7B',
    fontSize: 12,
    spacing: 8,
  })}`,
};

const FILL: Record<DrawioNodeKind, string> = {
  process: '#DAE8FC',
  decision: '#FFF2CC',
  start: '#D5E8D4',
  end: '#F8CECC',
  data: '#E1D5E7',
};

const STROKE: Record<DrawioNodeKind, string> = {
  process: '#6C8EBF',
  decision: '#D6B656',
  start: '#82B366',
  end: '#B85450',
  data: '#9673A6',
};

export function buildDrawioXml(diagram: DrawioDiagram): string {
  const placed = layoutDiagram(diagram);
  const pageWidth = Math.max(1169, placed.width);
  const pageHeight = Math.max(827, placed.height);
  const pageName = diagram.title || 'Page-1';
  const cells = [
    ...placed.nodes.map((node) => [
      `        <mxCell id="${escapeXml(cellId(node.id))}" value="${escapeXml(wrapLabel(node.label, node.kind))}" style="${NODE_STYLES[node.kind]}" vertex="1" parent="1">`,
      `          <mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n')),
    ...diagram.edges.map((edge, index) => edgeCell(edge, index, diagram, placed.nodes)),
  ];

  if (diagram.title.trim()) {
    cells.unshift([
      `        <mxCell id="title" value="${escapeXml(diagram.title.trim())}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontFamily=${FONT};fontSize=18;fontStyle=1;fontColor=#1A202C;spacing=4;" vertex="1" parent="1">`,
      `          <mxGeometry x="${MARGIN}" y="16" width="${Math.max(320, pageWidth - MARGIN * 2)}" height="28" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n'));
  }

  return [
    '<mxfile host="app.diagrams.net" agent="Inkline" version="24.7.17" type="device">',
    `  <diagram id="diagram-1" name="${escapeXml(pageName)}">`,
    `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">`,
    '      <root>',
    '        <mxCell id="0"/>',
    '        <mxCell id="1" parent="0"/>',
    ...cells,
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    '',
  ].join('\n');
}

export function buildDrawioPreviewSvg(diagram: DrawioDiagram): string {
  const placed = layoutDiagram(diagram);
  const width = Math.max(320, placed.width);
  const height = Math.max(180, placed.height);
  const nodeById = new Map(placed.nodes.map((node) => [node.id, node]));
  const title = diagram.title.trim()
    ? `<text x="${MARGIN}" y="34" font-family="${FONT}" font-size="16" font-weight="700" fill="#1A202C">${escapeXml(diagram.title.trim())}</text>`
    : '';
  const connectors = diagram.edges.map((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return '';
    const ports = edgePorts(from, to, edge.label, diagram.direction);
    const x1 = from.x + from.width * ports.exitX;
    const y1 = from.y + from.height * ports.exitY;
    const x2 = to.x + to.width * ports.entryX;
    const y2 = to.y + to.height * ports.entryY;
    const mid = orthogonalPath(x1, y1, x2, y2, diagram.direction);
    const label = edge.label
      ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#2D3748">${escapeXml(edge.label)}</text>`
      : '';
    return `<path d="${mid}" fill="none" stroke="#4A5568" stroke-width="1.6" marker-end="url(#arrow)"/>${label}`;
  }).join('');
  const shapes = placed.nodes.map((node) => `${svgShape(node)}${svgLabel(node)}`).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4A5568"/></marker></defs>',
    `<rect width="100%" height="100%" fill="#F8FAFC"/>`,
    title,
    connectors,
    shapes,
    '</svg>',
  ].join('');
}

function layoutDiagram(diagram: DrawioDiagram): { nodes: PlacedNode[]; width: number; height: number } {
  const layers = orderLayers(rankLayers(diagram), diagram);
  const horizontal = diagram.direction === 'left-right';
  const titleOffset = diagram.title.trim() ? TITLE_HEIGHT : 0;
  const layerSizes = layers.map((layer) => {
    const sizes = layer.map((id) => nodeSize(diagram.nodes.find((node) => node.id === id)?.kind ?? 'process'));
    const main = sizes.reduce((sum, size) => sum + (horizontal ? size.height : size.width), 0)
      + GAP * Math.max(0, layer.length - 1);
    const cross = Math.max(...sizes.map((size) => (horizontal ? size.width : size.height)));
    return { main, cross, sizes };
  });
  const maxMain = Math.max(...layerSizes.map((layer) => layer.main), 0);
  const placed: PlacedNode[] = [];

  if (!horizontal) {
    let y = MARGIN + titleOffset;
    layers.forEach((layer, layerIndex) => {
      const meta = layerSizes[layerIndex];
      let x = MARGIN + (maxMain - meta.main) / 2;
      layer.forEach((id, index) => {
        const node = diagram.nodes.find((item) => item.id === id);
        if (!node) return;
        const size = meta.sizes[index];
        placed.push({ ...node, ...size, x: snap(x), y: snap(y + (meta.cross - size.height) / 2) });
        x += size.width + GAP;
      });
      y += meta.cross + GAP;
    });
    return {
      nodes: placed,
      width: snap(MARGIN * 2 + maxMain),
      height: snap(y - GAP + MARGIN),
    };
  }

  let x = MARGIN;
  layers.forEach((layer, layerIndex) => {
    const meta = layerSizes[layerIndex];
    let y = MARGIN + titleOffset + (maxMain - meta.main) / 2;
    layer.forEach((id, index) => {
      const node = diagram.nodes.find((item) => item.id === id);
      if (!node) return;
      const size = meta.sizes[index];
      placed.push({ ...node, ...size, x: snap(x + (meta.cross - size.width) / 2), y: snap(y) });
      y += size.height + GAP;
    });
    x += meta.cross + GAP;
  });
  return {
    nodes: placed,
    width: snap(x - GAP + MARGIN),
    height: snap(MARGIN * 2 + titleOffset + maxMain),
  };
}

function rankLayers(diagram: DrawioDiagram): string[][] {
  const ids = diagram.nodes.map((node) => node.id);
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of diagram.edges) {
    if (edge.from === edge.to) continue;
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const rank = new Map<string, number>();
  const queue = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
  if (queue.length === 0) {
    return chunk(ids, 3);
  }

  for (const id of queue) rank.set(id, 0);
  const remaining = new Map(incoming);
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const nextRank = (rank.get(id) ?? 0) + 1;
    for (const child of outgoing.get(id) ?? []) {
      const current = remaining.get(child) ?? 0;
      remaining.set(child, current - 1);
      rank.set(child, Math.max(rank.get(child) ?? 0, nextRank));
      if (current - 1 === 0) queue.push(child);
    }
  }

  let extra = Math.max(0, ...rank.values()) + 1;
  for (const id of ids) {
    if (!rank.has(id)) {
      rank.set(id, extra);
      extra += 1;
    }
  }

  const maxRank = Math.max(0, ...rank.values());
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of ids) layers[rank.get(id) ?? 0].push(id);
  return layers.filter((layer) => layer.length > 0);
}

function orderLayers(layers: string[][], diagram: DrawioDiagram): string[][] {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const node of diagram.nodes) {
    parents.set(node.id, []);
    children.set(node.id, []);
  }
  for (const edge of diagram.edges) {
    children.get(edge.from)?.push(edge.to);
    parents.get(edge.to)?.push(edge.from);
  }

  const ordered = layers.map((layer) => [...layer]);
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 1; index < ordered.length; index += 1) {
      ordered[index] = sortByBarycenter(ordered[index], ordered[index - 1], parents);
    }
    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      ordered[index] = sortByBarycenter(ordered[index], ordered[index + 1], children);
    }
  }
  return ordered;
}

function sortByBarycenter(
  layer: string[],
  related: string[],
  links: Map<string, string[]>,
): string[] {
  const indexOf = new Map(related.map((id, index) => [id, index]));
  return [...layer].sort((left, right) => {
    const delta = barycenter(left, indexOf, links) - barycenter(right, indexOf, links);
    if (delta !== 0) return delta;
    return layer.indexOf(left) - layer.indexOf(right);
  });
}

function barycenter(
  id: string,
  relatedIndex: Map<string, number>,
  links: Map<string, string[]>,
): number {
  const connected = (links.get(id) ?? []).filter((item) => relatedIndex.has(item));
  if (connected.length === 0) return relatedIndex.size / 2;
  return connected.reduce((sum, item) => sum + (relatedIndex.get(item) ?? 0), 0) / connected.length;
}

function edgeCell(edge: DrawioEdge, index: number, diagram: DrawioDiagram, nodes: PlacedNode[]): string {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  const ports = from && to
    ? edgePorts(from, to, edge.label, diagram.direction)
    : { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
  const label = edge.label ? ` value="${escapeXml(edge.label)}"` : '';
  const style = [
    'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;',
    'endArrow=block;endFill=1;strokeColor=#4A5568;strokeWidth=1.4;',
    `fontFamily=${FONT};fontSize=11;fontColor=#2D3748;labelBackgroundColor=#FFFFFF;`,
    `exitX=${ports.exitX};exitY=${ports.exitY};exitDx=0;exitDy=0;`,
    `entryX=${ports.entryX};entryY=${ports.entryY};entryDx=0;entryDy=0;`,
  ].join('');
  return [
    `        <mxCell id="e-${index + 1}"${label} style="${style}" edge="1" parent="1" source="${escapeXml(cellId(edge.from))}" target="${escapeXml(cellId(edge.to))}">`,
    '          <mxGeometry relative="1" as="geometry"/>',
    '        </mxCell>',
  ].join('\n');
}

function edgePorts(
  from: PlacedNode,
  to: PlacedNode,
  label: string | undefined,
  direction: DrawioDirection,
) {
  const no = isNegative(label);
  const yes = isPositive(label);
  if (from.kind === 'decision' && (yes || no)) {
    if (direction === 'top-down') {
      return no
        ? { exitX: 0, exitY: 0.5, entryX: 0.5, entryY: 0 }
        : { exitX: 1, exitY: 0.5, entryX: 0.5, entryY: 0 };
    }
    return no
      ? { exitX: 0.5, exitY: 0, entryX: 0, entryY: 0.5 }
      : { exitX: 0.5, exitY: 1, entryX: 0, entryY: 0.5 };
  }
  if (direction === 'left-right') {
    if (to.x + to.width < from.x) return { exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5 };
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  if (to.y + to.height < from.y) return { exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 };
  return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
}

function wrapLabel(label: string, kind: DrawioNodeKind): string {
  const maxLine = kind === 'decision' ? 12 : 22;
  const maxLines = kind === 'decision' ? 3 : 3;
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLine) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxLine ? `${word.slice(0, maxLine - 1)}…` : word;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.join('<br>');
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxLine - 1))}…`;
  return kept.join('<br>');
}

function nodeSize(kind: DrawioNodeKind): Size {
  return KIND_SIZE[kind];
}

function cellId(id: string): string {
  return `n-${id}`;
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function isPositive(label?: string): boolean {
  return /^(yes|y|true|co|có|dung|đúng|ok)$/i.test((label ?? '').trim());
}

function isNegative(label?: string): boolean {
  return /^(no|n|false|khong|không|sai)$/i.test((label ?? '').trim());
}

function styleParts(options: {
  rounded?: number;
  arcSize?: number;
  fillColor: string;
  strokeColor: string;
  fontColor: string;
  fontSize: number;
  spacing: number;
}): string {
  const prefix = options.rounded
    ? `rounded=1;arcSize=${options.arcSize ?? 12};`
    : '';
  return `${prefix}whiteSpace=wrap;html=1;fillColor=${options.fillColor};strokeColor=${options.strokeColor};strokeWidth=1.5;fontFamily=${FONT};fontSize=${options.fontSize};fontColor=${options.fontColor};align=center;verticalAlign=middle;spacing=${options.spacing};`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function chunk(ids: string[], size: number): string[][] {
  const layers: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    layers.push(ids.slice(index, index + size));
  }
  return layers;
}

function orthogonalPath(x1: number, y1: number, x2: number, y2: number, direction: DrawioDirection): string {
  if (direction === 'left-right') {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
  }
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`;
}

function svgShape(node: PlacedNode): string {
  const fill = FILL[node.kind];
  const stroke = STROKE[node.kind];
  if (node.kind === 'decision') {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    return `<polygon points="${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  }
  if (node.kind === 'data') {
    const skew = 18;
    return `<polygon points="${node.x + skew},${node.y} ${node.x + node.width},${node.y} ${node.x + node.width - skew},${node.y + node.height} ${node.x},${node.y + node.height}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  }
  const radius = node.kind === 'start' || node.kind === 'end' ? node.height / 2 : 12;
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
}

function svgLabel(node: PlacedNode): string {
  const lines = wrapLabel(node.label, node.kind).split('<br>').filter(Boolean);
  const lineHeight = 14;
  const start = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2 + 4;
  const spans = lines.map((line, index) => (
    `<tspan x="${node.x + node.width / 2}" y="${start + index * lineHeight}">${escapeXml(line)}</tspan>`
  )).join('');
  return `<text text-anchor="middle" font-family="${FONT}" font-size="${node.kind === 'decision' ? 11 : 12}" fill="#1A202C">${spans}</text>`;
}
