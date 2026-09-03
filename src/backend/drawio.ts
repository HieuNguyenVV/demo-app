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

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const DECISION_SIZE = 120;
const GAP_X = 48;
const GAP_Y = 88;
const MARGIN = 40;

const NODE_STYLES: Record<DrawioNodeKind, string> = {
  process: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;',
  decision: 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;',
  start: 'ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;',
  end: 'ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;',
  data: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;',
};

export function buildDrawioXml(diagram: DrawioDiagram): string {
  const positions = layout(diagram);
  let maxX = 0;
  let maxY = 0;
  const nodeCells = diagram.nodes.map((node) => {
    const size = nodeSize(node.kind);
    const point = positions.get(node.id) ?? { x: MARGIN, y: MARGIN };
    maxX = Math.max(maxX, point.x + size.width);
    maxY = Math.max(maxY, point.y + size.height);
    return [
      `        <mxCell id="${escapeXml(cellId(node.id))}" value="${escapeXml(node.label)}" style="${NODE_STYLES[node.kind]}" vertex="1" parent="1">`,
      `          <mxGeometry x="${point.x}" y="${point.y}" width="${size.width}" height="${size.height}" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n');
  });

  const edgeCells = diagram.edges.map((edge, index) => {
    const label = edge.label ? ` value="${escapeXml(edge.label)}"` : '';
    return [
      `        <mxCell id="e-${index + 1}"${label} style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;" edge="1" parent="1" source="${escapeXml(cellId(edge.from))}" target="${escapeXml(cellId(edge.to))}">`,
      '          <mxGeometry relative="1" as="geometry"/>',
      '        </mxCell>',
    ].join('\n');
  });

  const pageWidth = Math.max(1169, Math.ceil(maxX + MARGIN));
  const pageHeight = Math.max(827, Math.ceil(maxY + MARGIN));
  const pageName = diagram.title || 'Page-1';

  return [
    '<mxfile host="app.diagrams.net" agent="Inkline" version="22.1.16" type="device">',
    `  <diagram id="diagram-1" name="${escapeXml(pageName)}">`,
    `    <mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">`,
    '      <root>',
    '        <mxCell id="0"/>',
    '        <mxCell id="1" parent="0"/>',
    ...nodeCells,
    ...edgeCells,
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    '',
  ].join('\n');
}

function layout(diagram: DrawioDiagram): Map<string, { x: number; y: number }> {
  const layers = rankLayers(diagram.nodes.map((node) => node.id), diagram.edges);
  const positions = new Map<string, { x: number; y: number }>();
  const horizontal = diagram.direction === 'left-right';

  layers.forEach((layer, layerIndex) => {
    layer.forEach((id, index) => {
      const node = diagram.nodes.find((item) => item.id === id);
      const size = nodeSize(node?.kind ?? 'process');
      const slotX = index * (NODE_WIDTH + GAP_X);
      const slotY = layerIndex * (NODE_HEIGHT + GAP_Y);
      positions.set(id, {
        x: MARGIN + (horizontal ? slotY : slotX),
        y: MARGIN + (horizontal ? slotX : slotY) + (NODE_HEIGHT - size.height) / 2,
      });
    });
  });

  return positions;
}

function rankLayers(ids: string[], edges: DrawioEdge[]): string[][] {
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const rank = new Map<string, number>();
  const queue = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
  if (queue.length === 0) {
    return chunk(ids, 4);
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

  const placed = new Set(rank.keys());
  let extra = Math.max(0, ...rank.values()) + 1;
  for (const id of ids) {
    if (!placed.has(id)) {
      rank.set(id, extra);
      extra += 1;
    }
  }

  const maxRank = Math.max(0, ...rank.values());
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of ids) {
    layers[rank.get(id) ?? 0].push(id);
  }
  return layers.filter((layer) => layer.length > 0);
}

function nodeSize(kind: DrawioNodeKind): { width: number; height: number } {
  if (kind === 'decision') {
    return { width: DECISION_SIZE, height: DECISION_SIZE };
  }
  if (kind === 'start' || kind === 'end') {
    return { width: 140, height: 60 };
  }
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function cellId(id: string): string {
  return `n-${id}`;
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
