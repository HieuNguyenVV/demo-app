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
const GAP_X = 88;
const GAP_Y = 108;
const LANE_GAP = 96;
const MARGIN = 72;
const TITLE_HEIGHT = 56;
const GRID = 10;

const KIND_SIZE: Record<DrawioNodeKind, Size> = {
  process: { width: 220, height: 78 },
  decision: { width: 168, height: 168 },
  start: { width: 188, height: 60 },
  end: { width: 188, height: 60 },
  data: { width: 210, height: 74 },
};

const NODE_STYLES: Record<DrawioNodeKind, string> = {
  process: styleParts({
    rounded: 1,
    arcSize: 14,
    fillColor: '#DAE8FC',
    strokeColor: '#6C8EBF',
    fontColor: '#1A365D',
    fontSize: 14,
    spacing: 12,
  }),
  decision: `rhombus;${styleParts({
    fillColor: '#FFF2CC',
    strokeColor: '#D6B656',
    fontColor: '#744210',
    fontSize: 13,
    spacing: 10,
  })}`,
  start: styleParts({
    rounded: 1,
    arcSize: 50,
    fillColor: '#D5E8D4',
    strokeColor: '#82B366',
    fontColor: '#276749',
    fontSize: 14,
    spacing: 10,
  }),
  end: styleParts({
    rounded: 1,
    arcSize: 50,
    fillColor: '#F8CECC',
    strokeColor: '#B85450',
    fontColor: '#9B2C2C',
    fontSize: 14,
    spacing: 10,
  }),
  data: `shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;${styleParts({
    fillColor: '#E1D5E7',
    strokeColor: '#9673A6',
    fontColor: '#553C7B',
    fontSize: 14,
    spacing: 10,
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
  const pageWidth = placed.width;
  const pageHeight = placed.height;
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
      `        <mxCell id="title" value="${escapeXml(diagram.title.trim())}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontFamily=${FONT};fontSize=22;fontStyle=1;fontColor=#1A202C;spacing=4;" vertex="1" parent="1">`,
      `          <mxGeometry x="${MARGIN}" y="20" width="${Math.max(240, pageWidth - MARGIN * 2)}" height="32" as="geometry"/>`,
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
    ? `<text x="${placed.width / 2}" y="40" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="700" fill="#1A202C">${escapeXml(diagram.title.trim())}</text>`
    : '';
  const connectors = diagram.edges.map((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return '';
    const ports = edgePorts(from, to, diagram.direction);
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
  if (diagram.direction === 'left-right') {
    return layoutSugiyama(diagram, true);
  }
  return layoutFlowTopDown(diagram);
}

function layoutFlowTopDown(diagram: DrawioDiagram): { nodes: PlacedNode[]; width: number; height: number } {
  const layers = rankLayers(diagram);
  const rankOf = new Map<string, number>();
  layers.forEach((layer, index) => {
    for (const id of layer) rankOf.set(id, index);
  });
  const spine = pickSpine(diagram, rankOf);
  const laneOf = assignLanes(diagram, spine, rankOf);
  const lanes = [...laneOf.values()];
  const minLane = Math.min(0, ...lanes);
  const maxLane = Math.max(0, ...lanes);
  const colWidth = Math.max(...diagram.nodes.map((node) => nodeSize(node.kind).width)) + LANE_GAP;
  const titleOffset = diagram.title.trim() ? TITLE_HEIGHT : 0;
  const rowHeight = layers.map((layer) => Math.max(...layer.map((id) => {
    const kind = diagram.nodes.find((node) => node.id === id)?.kind ?? 'process';
    return nodeSize(kind).height;
  })));
  const rowY: number[] = [];
  let y = MARGIN + titleOffset;
  layers.forEach((layer, index) => {
    rowY[index] = y;
    const decisionPad = layer.some((id) => diagram.nodes.find((node) => node.id === id)?.kind === 'decision') ? 28 : 0;
    y += rowHeight[index] + GAP_Y + decisionPad;
  });

  const placed: PlacedNode[] = diagram.nodes.map((node) => {
    const size = nodeSize(node.kind);
    const rank = rankOf.get(node.id) ?? 0;
    const lane = laneOf.get(node.id) ?? 0;
    const colX = MARGIN + (lane - minLane) * colWidth;
    return {
      ...node,
      ...size,
      x: snap(colX + (colWidth - LANE_GAP - size.width) / 2),
      y: snap(rowY[rank] + (rowHeight[rank] - size.height) / 2),
    };
  });

  return {
    nodes: placed,
    width: snap(MARGIN * 2 + (maxLane - minLane + 1) * colWidth - LANE_GAP),
    height: snap(y - GAP_Y + MARGIN),
  };
}

function pickSpine(diagram: DrawioDiagram, rankOf: Map<string, number>): Set<string> {
  const children = new Map<string, DrawioEdge[]>(diagram.nodes.map((node) => [node.id, []]));
  for (const edge of diagram.edges) {
    if ((rankOf.get(edge.to) ?? 0) <= (rankOf.get(edge.from) ?? 0)) continue;
    children.get(edge.from)?.push(edge);
  }
  for (const edges of children.values()) {
    edges.sort((left, right) => edgePriority(right) - edgePriority(left));
  }

  const memo = new Map<string, string[]>();
  const walk = (id: string, visiting: Set<string>): string[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return [id];
    visiting.add(id);
    let best = [id];
    for (const edge of children.get(id) ?? []) {
      const rest = walk(edge.to, visiting);
      if (rest.length + 1 > best.length) best = [id, ...rest];
    }
    visiting.delete(id);
    memo.set(id, best);
    return best;
  };

  const starts = diagram.nodes.filter((node) => node.kind === 'start').map((node) => node.id);
  const incomingForward = new Set(
    diagram.edges
      .filter((edge) => (rankOf.get(edge.to) ?? 0) > (rankOf.get(edge.from) ?? 0))
      .map((edge) => edge.to),
  );
  const roots = starts.length > 0
    ? starts
    : diagram.nodes.map((node) => node.id).filter((id) => !incomingForward.has(id));
  let best: string[] = [];
  for (const root of (roots.length > 0 ? roots : diagram.nodes.slice(0, 1).map((node) => node.id))) {
    const path = walk(root, new Set());
    if (path.length > best.length) best = path;
  }
  return new Set(best);
}

function edgePriority(edge: DrawioEdge): number {
  if (isPositive(edge.label) || !edge.label) return 2;
  if (isNegative(edge.label)) return 0;
  return 1;
}

function assignLanes(
  diagram: DrawioDiagram,
  spine: Set<string>,
  rankOf: Map<string, number>,
): Map<string, number> {
  const lane = new Map<string, number>();
  for (const id of spine) lane.set(id, 0);

  const components: string[][] = [];
  const seen = new Set<string>();
  for (const node of diagram.nodes) {
    if (spine.has(node.id) || seen.has(node.id)) continue;
    const component: string[] = [];
    const stack = [node.id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || seen.has(current) || spine.has(current)) continue;
      seen.add(current);
      component.push(current);
      for (const edge of diagram.edges) {
        if (edge.from === current && !spine.has(edge.to)) stack.push(edge.to);
        if (edge.to === current && !spine.has(edge.from)) stack.push(edge.from);
      }
    }
    if (component.length > 0) components.push(component);
  }

  components.sort((left, right) => (
    Math.min(...left.map((id) => rankOf.get(id) ?? 0)) - Math.min(...right.map((id) => rankOf.get(id) ?? 0))
  ));

  let nextLeft = -1;
  let nextRight = 1;
  const leftPack: Array<{ lane: number; ranks: Set<number> }> = [];
  const rightPack: Array<{ lane: number; ranks: Set<number> }> = [];

  for (const component of components) {
    const ranks = new Set(component.map((id) => rankOf.get(id) ?? 0));
    const inbound = diagram.edges.filter((edge) => spine.has(edge.from) && component.includes(edge.to));
    const pack = inbound.some((edge) => isNegative(edge.label)) ? leftPack : rightPack;
    const existing = pack.find((slot) => ![...ranks].some((rank) => slot.ranks.has(rank)));
    let assigned: number;
    if (existing) {
      assigned = existing.lane;
      for (const rank of ranks) existing.ranks.add(rank);
    } else {
      assigned = inbound.some((edge) => isNegative(edge.label)) ? nextLeft-- : nextRight++;
      pack.push({ lane: assigned, ranks });
    }
    for (const id of component) lane.set(id, assigned);
  }

  for (const node of diagram.nodes) {
    if (!lane.has(node.id)) lane.set(node.id, 0);
  }
  return lane;
}

function layoutSugiyama(diagram: DrawioDiagram, horizontal: boolean): { nodes: PlacedNode[]; width: number; height: number } {
  const layers = orderLayers(rankLayers(diagram), diagram);
  const titleOffset = diagram.title.trim() ? TITLE_HEIGHT : 0;
  const layerSizes = layers.map((layer) => {
    const sizes = layer.map((id) => nodeSize(diagram.nodes.find((node) => node.id === id)?.kind ?? 'process'));
    const main = sizes.reduce((sum, size) => sum + (horizontal ? size.height : size.width), 0)
      + (horizontal ? GAP_Y : GAP_X) * Math.max(0, layer.length - 1);
    const cross = Math.max(...sizes.map((size) => (horizontal ? size.width : size.height)));
    return { main, cross, sizes };
  });
  const maxMain = Math.max(...layerSizes.map((layer) => layer.main), 0);
  const placed: PlacedNode[] = [];
  const alongGap = horizontal ? GAP_X : GAP_Y;
  const crossGap = horizontal ? GAP_Y : GAP_X;

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
        x += size.width + crossGap;
      });
      y += meta.cross + alongGap;
    });
    return {
      nodes: placed,
      width: snap(MARGIN * 2 + maxMain),
      height: snap(y - alongGap + MARGIN),
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
      y += size.height + crossGap;
    });
    x += meta.cross + alongGap;
  });
  return {
    nodes: placed,
    width: snap(x - alongGap + MARGIN),
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
    ? edgePorts(from, to, diagram.direction)
    : { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
  const points = from && to ? routePoints(from, to, ports) : [];
  const label = edge.label ? ` value="${escapeXml(edge.label)}"` : '';
  const style = [
    'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;',
    'endArrow=block;endFill=1;strokeColor=#4A5568;strokeWidth=1.6;',
    `fontFamily=${FONT};fontSize=12;fontColor=#2D3748;fontStyle=1;labelBackgroundColor=#FFFFFF;`,
    `exitX=${ports.exitX};exitY=${ports.exitY};exitDx=0;exitDy=0;`,
    `entryX=${ports.entryX};entryY=${ports.entryY};entryDx=0;entryDy=0;`,
  ].join('');
  const geometry = points.length > 0
    ? [
      '          <mxGeometry relative="1" as="geometry">',
      '            <Array as="points">',
      ...points.map((point) => `              <mxPoint x="${point.x}" y="${point.y}"/>`),
      '            </Array>',
      '          </mxGeometry>',
    ].join('\n')
    : '          <mxGeometry relative="1" as="geometry"/>';
  return [
    `        <mxCell id="e-${index + 1}"${label} style="${style}" edge="1" parent="1" source="${escapeXml(cellId(edge.from))}" target="${escapeXml(cellId(edge.to))}">`,
    geometry,
    '        </mxCell>',
  ].join('\n');
}

function edgePorts(from: PlacedNode, to: PlacedNode, direction: DrawioDirection) {
  if (direction === 'left-right') {
    if (to.x + to.width < from.x) return { exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5 };
    if (to.y + to.height < from.y - 16) return { exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 };
    if (to.y > from.y + from.height + 16) return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  if (to.y + to.height < from.y - 16) {
    return { exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  if (to.x + to.width < from.x - 24) {
    return { exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5 };
  }
  if (to.x > from.x + from.width + 24) {
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
}

function routePoints(
  from: PlacedNode,
  to: PlacedNode,
  ports: { exitX: number; exitY: number; entryX: number; entryY: number },
): Array<{ x: number; y: number }> {
  if (to.y + to.height < from.y - 16 && Math.abs(from.x - to.x) < 30) {
    const gutter = Math.min(from.x, to.x) - 48;
    return [
      { x: snap(gutter), y: snap(from.y + from.height * ports.exitY) },
      { x: snap(gutter), y: snap(to.y + to.height * ports.entryY) },
    ];
  }
  return [];
}

function wrapLabel(label: string, kind: DrawioNodeKind): string {
  const maxLine = kind === 'decision' ? 14 : 26;
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
  const lineHeight = 16;
  const start = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2 + 5;
  const spans = lines.map((line, index) => (
    `<tspan x="${node.x + node.width / 2}" y="${start + index * lineHeight}">${escapeXml(line)}</tspan>`
  )).join('');
  return `<text text-anchor="middle" font-family="${FONT}" font-size="${node.kind === 'decision' ? 13 : 14}" fill="#1A202C">${spans}</text>`;
}
