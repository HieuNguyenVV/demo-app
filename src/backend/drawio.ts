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
const BOX_W = 200;
const SIDE_W = BOX_W;
const SIDE_GAP = 24;
const STRIP_GAP = 48;
const NODE_GAP = 26;
const GAP_X = 56;
const GAP_Y = 36;
const MARGIN = 36;
const TITLE_HEIGHT = 40;
const GRID = 10;
const LOOP_GUTTER = 32;

const KIND_SIZE: Record<DrawioNodeKind, Size> = {
  process: { width: BOX_W, height: 56 },
  decision: { width: 100, height: 100 },
  start: { width: BOX_W, height: 50 },
  end: { width: BOX_W, height: 50 },
  data: { width: BOX_W, height: 56 },
};

const NODE_STYLES: Record<DrawioNodeKind, string> = {
  process: styleParts({
    rounded: 1,
    arcSize: 14,
    fillColor: '#DAE8FC',
    strokeColor: '#6C8EBF',
    fontColor: '#1A365D',
    fontSize: 12,
    spacing: 8,
  }),
  decision: `rhombus;${styleParts({
    fillColor: '#FFF2CC',
    strokeColor: '#D6B656',
    fontColor: '#744210',
    fontSize: 11,
    spacing: 6,
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
    const bounds = { bottom: Math.max(...placed.nodes.map((node) => node.y + node.height)) };
    const path = connectorCoords(from, to, ports, bounds);
    const labelAt = edgeLabelPoint(path);
    const d = path.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const label = edge.label
      ? `<text x="${labelAt.x}" y="${labelAt.y}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#2D3748">${escapeXml(edge.label)}</text>`
      : '';
    return `<path d="${d}" fill="none" stroke="#4A5568" stroke-width="1.6" marker-end="url(#arrow)"/>${label}`;
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
  const layers = rankLayers(diagram);
  const maxLayer = Math.max(0, ...layers.map((layer) => layer.length));
  const horizontal = diagram.direction === 'left-right';
  if (maxLayer >= 3) {
    return layoutSugiyama(diagram, horizontal);
  }
  return layoutBalancedFlow(diagram, horizontal);
}

function layoutBalancedFlow(
  diagram: DrawioDiagram,
  horizontal: boolean,
): { nodes: PlacedNode[]; width: number; height: number } {
  const rankOf = new Map<string, number>();
  rankLayers(diagram).forEach((layer, index) => {
    for (const id of layer) rankOf.set(id, index);
  });
  const spinePath = pickSpinePath(diagram, rankOf);
  const spineSet = new Set(spinePath);
  const components = sideComponents(diagram, spineSet, rankOf);
  const { cells, strips } = chooseGrid(spinePath.length, horizontal);
  const titleOffset = diagram.title.trim() ? TITLE_HEIGHT : 0;
  const spineSlot = horizontal ? KIND_SIZE.decision.height : BOX_W;
  const sideSlot = horizontal ? KIND_SIZE.process.height : BOX_W;
  const parentStrip = new Map<string, number>();
  for (const component of components) {
    const inbound = inboundToComponent(diagram, spineSet, component);
    const parentIndex = Math.max(0, spinePath.indexOf(inbound[0]?.from ?? spinePath[0]));
    const strip = Math.min(strips - 1, Math.floor(parentIndex / cells));
    for (const id of component) parentStrip.set(id, strip);
  }
  const leftSides = !horizontal && strips > 1 && [...parentStrip.values()].some((strip) => strip === 0);
  const rightSides = components.length > 0 && (strips === 1 || [...parentStrip.values()].some((strip) => strip > 0));

  const stripMain: number[] = [];
  let cursor = MARGIN + (horizontal ? titleOffset : 0);
  const leftMain = cursor;
  if (leftSides) cursor += sideSlot + SIDE_GAP;
  for (let strip = 0; strip < strips; strip += 1) {
    stripMain[strip] = cursor;
    cursor += spineSlot + STRIP_GAP;
  }
  cursor -= STRIP_GAP;
  const rightMain = cursor + SIDE_GAP;
  if (rightSides) cursor = rightMain + sideSlot;

  components.sort((left, right) => {
    const leftParent = inboundToComponent(diagram, spineSet, left)[0]?.from ?? '';
    const rightParent = inboundToComponent(diagram, spineSet, right)[0]?.from ?? '';
    return (rankOf.get(leftParent) ?? 0) - (rankOf.get(rightParent) ?? 0);
  });
  const placed = new Map<string, PlacedNode>();
  const stripAlong: number[] = Array.from({ length: strips }, () => MARGIN + (horizontal ? 0 : titleOffset));
  for (let strip = 0; strip < strips; strip += 1) {
    let along = stripAlong[strip];
    const start = strip * cells;
    const end = Math.min(spinePath.length, start + cells);
    for (let index = start; index < end; index += 1) {
      const node = diagram.nodes.find((item) => item.id === spinePath[index]);
      if (!node) continue;
      const size = nodeSize(node.kind);
      placed.set(node.id, { ...node, ...size, ...axisPoint(horizontal, stripMain[strip], along, size, spineSlot) });
      along += (horizontal ? size.width : size.height) + NODE_GAP;
    }
    stripAlong[strip] = along;
  }

  for (const component of components) {
    const inbound = inboundToComponent(diagram, spineSet, component);
    const parent = placed.get(inbound[0]?.from ?? spinePath[0]);
    const strip = parentStrip.get(component[0]) ?? 0;
    const sideMain = !horizontal && strips > 1 && strip === 0 ? leftMain : rightMain;
    let sideAlong = parent
      ? (horizontal
        ? parent.x + Math.max(0, (parent.width - SIDE_W) / 2)
        : parent.y + Math.max(0, (parent.height - KIND_SIZE.process.height) / 2))
      : MARGIN + (horizontal ? 0 : titleOffset);
    for (const id of component) {
      const node = diagram.nodes.find((item) => item.id === id);
      if (!node) continue;
      const size = nodeSize(node.kind);
      const slot = axisPoint(horizontal, sideMain, sideAlong, size, sideSlot);
      const box = nudgeClear({ ...node, ...size, ...slot }, [...placed.values()], horizontal);
      placed.set(id, box);
      sideAlong = (horizontal ? box.x + box.width : box.y + box.height) + NODE_GAP;
    }
  }

  for (const node of diagram.nodes) {
    if (placed.has(node.id)) continue;
    const size = nodeSize(node.kind);
    const strip = Math.max(0, strips - 1);
    const along = stripAlong[strip] ?? MARGIN;
    const box = nudgeClear(
      { ...node, ...size, ...axisPoint(horizontal, stripMain[strip] ?? MARGIN, along, size, spineSlot) },
      [...placed.values()],
      horizontal,
    );
    placed.set(node.id, box);
    stripAlong[strip] = (horizontal ? box.x + box.width : box.y + box.height) + NODE_GAP;
  }

  const nodes = [...placed.values()];
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    nodes,
    width: snap(Math.max(right, horizontal ? 0 : cursor) + LOOP_GUTTER + MARGIN),
    height: snap(Math.max(bottom, horizontal ? cursor : 0) + LOOP_GUTTER + MARGIN),
  };
}

function axisPoint(
  horizontal: boolean,
  stripPos: number,
  along: number,
  size: Size,
  slot: number,
): Point {
  if (horizontal) {
    return {
      x: snap(along),
      y: snap(stripPos + Math.max(0, (slot - size.height) / 2)),
    };
  }
  return {
    x: snap(stripPos + Math.max(0, (slot - size.width) / 2)),
    y: snap(along),
  };
}

function nudgeClear(node: PlacedNode, others: PlacedNode[], horizontal: boolean): PlacedNode {
  const next = { ...node };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (!others.some((other) => overlaps(next, other))) return next;
    if (horizontal) next.x = snap(next.x + 24);
    else next.y = snap(next.y + 24);
  }
  return next;
}

function overlaps(left: PlacedNode, right: PlacedNode): boolean {
  return left.x < right.x + right.width + 12
    && left.x + left.width + 12 > right.x
    && left.y < right.y + right.height + 12
    && left.y + left.height + 12 > right.y;
}

function chooseGrid(
  count: number,
  horizontal: boolean,
): { cells: number; strips: number } {
  if (!horizontal) {
    if (count <= 8) return { cells: count, strips: 1 };
    return { cells: Math.ceil(count / 2), strips: 2 };
  }
  if (count <= 6) return { cells: count, strips: 1 };
  const strips = count <= 12 ? 2 : 3;
  return { cells: Math.ceil(count / strips), strips };
}

function inboundToComponent(
  diagram: DrawioDiagram,
  spine: Set<string>,
  component: string[],
): DrawioEdge[] {
  return diagram.edges.filter((edge) => spine.has(edge.from) && component.includes(edge.to));
}

function sideComponents(
  diagram: DrawioDiagram,
  spine: Set<string>,
  rankOf: Map<string, number>,
): string[][] {
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
    if (component.length > 0) {
      component.sort((left, right) => (rankOf.get(left) ?? 0) - (rankOf.get(right) ?? 0));
      components.push(component);
    }
  }
  return components;
}

function pickSpinePath(diagram: DrawioDiagram, rankOf: Map<string, number>): string[] {
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
  return best.length > 0 ? best : diagram.nodes.map((node) => node.id);
}

function edgePriority(edge: DrawioEdge): number {
  if (isPositive(edge.label) || !edge.label) return 2;
  if (isNegative(edge.label)) return 0;
  return 1;
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
  const bounds = { bottom: Math.max(...nodes.map((node) => node.y + node.height), 0) };
  const points = from && to ? routePoints(from, to, ports, bounds) : [];
  const label = edge.label ? ` value="${escapeXml(edge.label)}"` : '';
  const style = [
    'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;',
    'endArrow=block;endFill=1;strokeColor=#4A5568;strokeWidth=1.6;',
    `fontFamily=${FONT};fontSize=12;fontColor=#2D3748;fontStyle=1;labelBackgroundColor=#FFFFFF;`,
    `exitX=${ports.exitX};exitY=${ports.exitY};exitDx=0;exitDy=0;`,
    `entryX=${ports.entryX};entryY=${ports.entryY};entryDx=0;entryDy=0;`,
  ].join('');
  const geometry = [
    '          <mxGeometry relative="1" as="geometry">',
    ...(points.length > 0
      ? [
        '            <Array as="points">',
        ...points.map((point) => `              <mxPoint x="${point.x}" y="${point.y}"/>`),
        '            </Array>',
      ]
      : []),
    ...(edge.label ? ['            <mxPoint x="12" y="-10" as="offset"/>'] : []),
    '          </mxGeometry>',
  ].join('\n');
  return [
    `        <mxCell id="e-${index + 1}"${label} style="${style}" edge="1" parent="1" source="${escapeXml(cellId(edge.from))}" target="${escapeXml(cellId(edge.to))}">`,
    geometry,
    '        </mxCell>',
  ].join('\n');
}

function edgePorts(from: PlacedNode, to: PlacedNode, direction: DrawioDirection) {
  const fromCx = from.x + from.width / 2;
  const toCx = to.x + to.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  if (direction === 'left-right') {
    if (to.x + to.width < from.x - 16 && to.y > from.y + from.height + 12) {
      return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
    }
    if (to.x + to.width < from.x - 16) {
      return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 1 };
    }
    if (Math.abs(dy) > 40 && dx > 24) {
      return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
    }
    if (to.y > from.y + from.height + 16) {
      return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
    }
    if (to.y + to.height < from.y - 16) {
      return { exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1 };
    }
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }

  if (dx > 40 && to.y + to.height < from.y - 8) {
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  if (dx < -40 && Math.abs(fromCy - toCy) > 40) {
    return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 1 };
  }
  if (dy < -20) {
    return { exitX: 1, exitY: 0.5, entryX: 1, entryY: 0.5 };
  }
  if (dx > 24 && Math.abs(fromCy - toCy) < 56) {
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  if (dx < -24 && Math.abs(fromCy - toCy) < 56) {
    return { exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5 };
  }
  if (dx > 40) {
    return { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
  }
  return { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 };
}

function routePoints(
  from: PlacedNode,
  to: PlacedNode,
  ports: { exitX: number; exitY: number; entryX: number; entryY: number },
  bounds?: { bottom: number },
): Array<{ x: number; y: number }> {
  const x1 = from.x + from.width * ports.exitX;
  const y1 = from.y + from.height * ports.exitY;
  const x2 = to.x + to.width * ports.entryX;
  const y2 = to.y + to.height * ports.entryY;

  if (ports.exitX === 1 && ports.entryX === 1) {
    const gutter = snap(Math.max(from.x + from.width, to.x + to.width) + LOOP_GUTTER);
    return [
      { x: gutter, y: snap(y1) },
      { x: gutter, y: snap(y2) },
    ];
  }
  if (ports.exitY === 1 && ports.entryY === 1) {
    const bottom = snap(Math.max(from.y + from.height, to.y + to.height, bounds?.bottom ?? 0) + LOOP_GUTTER);
    if (to.x + to.width < from.x) {
      const right = snap(from.x + from.width + LOOP_GUTTER);
      const left = snap(Math.max(12, to.x - LOOP_GUTTER));
      return [
        { x: right, y: snap(y1) },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: snap(y2) },
      ];
    }
    return [
      { x: snap(x1), y: bottom },
      { x: snap(x2), y: bottom },
    ];
  }
  if (ports.exitX === 1 && ports.entryX === 0 && to.x > from.x + from.width) {
    if (Math.abs(y1 - y2) < 10) return [];
    const gutter = snap((from.x + from.width + to.x) / 2);
    return [
      { x: gutter, y: snap(y1) },
      { x: gutter, y: snap(y2) },
    ];
  }
  if (ports.exitY === 1 && ports.entryY === 0 && to.y > from.y + from.height) {
    if (Math.abs(x1 - x2) < 10) return [];
    const midY = snap((from.y + from.height + to.y) / 2);
    return [
      { x: snap(x1), y: midY },
      { x: snap(x2), y: midY },
    ];
  }
  return [];
}

function edgeLabelPoint(path: Array<{ x: number; y: number }>): { x: number; y: number } {
  const start = path[0];
  const next = path[1] ?? start;
  const x = start.x + (next.x - start.x) * 0.4;
  const y = start.y + (next.y - start.y) * 0.4;
  if (Math.abs(next.x - start.x) < 10) return { x: x + 16, y };
  if (Math.abs(next.y - start.y) < 10) return { x, y: y - 10 };
  return { x, y: y - 8 };
}

function connectorCoords(
  from: PlacedNode,
  to: PlacedNode,
  ports: { exitX: number; exitY: number; entryX: number; entryY: number },
  bounds?: { bottom: number },
): Array<{ x: number; y: number }> {
  return [
    { x: from.x + from.width * ports.exitX, y: from.y + from.height * ports.exitY },
    ...routePoints(from, to, ports, bounds),
    { x: to.x + to.width * ports.entryX, y: to.y + to.height * ports.entryY },
  ];
}

function wrapLabel(label: string, kind: DrawioNodeKind): string {
  const maxLine = kind === 'decision' ? 16 : 24;
  const maxLines = kind === 'decision' ? 3 : 3;
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const pieces = word.length > maxLine ? chunkWord(word, maxLine) : [word];
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (next.length <= maxLine) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      current = piece;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.join('<br>');
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxLine - 1))}…`;
  return kept.join('<br>');
}

function chunkWord(word: string, size: number): string[] {
  const pieces: string[] = [];
  for (let index = 0; index < word.length; index += size) {
    pieces.push(word.slice(index, index + size));
  }
  return pieces;
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
  const lineHeight = 15;
  const start = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2 + 5;
  const spans = lines.map((line, index) => (
    `<tspan x="${node.x + node.width / 2}" y="${start + index * lineHeight}">${escapeXml(line)}</tspan>`
  )).join('');
  return `<text text-anchor="middle" font-family="${FONT}" font-size="${node.kind === 'decision' ? 11 : 12}" fill="#1A202C">${spans}</text>`;
}
