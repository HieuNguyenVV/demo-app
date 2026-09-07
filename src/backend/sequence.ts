export type SequenceMessageKind = 'sync' | 'async' | 'return' | 'self';

export type SequenceParticipant = {
  id: string;
  label: string;
};

export type SequenceMessage = {
  from: string;
  to: string;
  label?: string;
  kind: SequenceMessageKind;
};

export type SequenceDiagram = {
  title: string;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
};

/** SequenceDiagram.org source (.txt). */
export function buildSequenceSourceText(diagram: SequenceDiagram): string {
  const lines: string[] = [];
  if (diagram.title.trim()) {
    lines.push(`title ${seqText(diagram.title)}`);
    lines.push('');
  }
  for (const participant of diagram.participants) {
    lines.push(participantLine(participant));
  }
  if (diagram.participants.length > 0) {
    lines.push('');
  }
  for (const message of diagram.messages) {
    lines.push(messageLine(diagram, message));
  }
  return `${lines.join('\n')}\n`;
}

function participantLine(participant: SequenceParticipant): string {
  const name = seqText(participant.label);
  return needsQuotes(name) ? `participant "${name.replace(/"/g, "'")}"` : `participant ${name}`;
}

function messageLine(diagram: SequenceDiagram, message: SequenceMessage): string {
  const from = actorName(diagram, message.from);
  const to = actorName(diagram, message.to);
  const label = seqText(message.label ?? '');
  const kind = message.from === message.to ? 'self' : message.kind;
  if (kind === 'return') {
    return `${to}<--${from}:${label}`;
  }
  if (kind === 'async') {
    return `${from}->(1)${to}:${label}`;
  }
  return `${from}->${to}:${label}`;
}

function actorName(diagram: SequenceDiagram, id: string): string {
  const participant = diagram.participants.find((item) => item.id === id);
  return participant ? seqText(participant.label) : id;
}

function seqText(value: string): string {
  return value.replace(/[\r\n]+/g, '\\n').replace(/->/g, '→').trim();
}

function needsQuotes(name: string): boolean {
  return !/^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

const FONT = 'Helvetica';
const MARGIN = 40;
const TITLE_H = 40;
const BOX_W = 132;
const BOX_H = 42;
const COL_GAP = 56;
const MSG_GAP = 42;
const SELF_BUMP = 36;
const GRID = 10;
const LIFELINE_PAD = 40;

export function buildSequenceXml(diagram: SequenceDiagram): string {
  const laid = layoutSequence(diagram);
  const pageName = diagram.title || 'Sequence';
  const cells = [
    ...laid.heads.map((head) => [
      `        <mxCell id="${escapeXml(head.cellId)}" value="${escapeXml(wrapLabel(head.label, 18))}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;strokeWidth=1.5;fontFamily=${FONT};fontSize=12;fontColor=#1A365D;align=center;verticalAlign=middle;spacing=6;" vertex="1" parent="1">`,
      `          <mxGeometry x="${head.x}" y="${head.y}" width="${BOX_W}" height="${BOX_H}" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n')),
    ...laid.heads.map((head) => [
      `        <mxCell id="${escapeXml(head.cellId)}-line" style="endArrow=none;html=1;dashed=1;dashPattern=8 6;strokeColor=#A0AEC0;strokeWidth=1.4;" edge="1" parent="1">`,
      '          <mxGeometry relative="1" as="geometry">',
      `            <mxPoint x="${head.cx}" y="${laid.lineTop}" as="sourcePoint"/>`,
      `            <mxPoint x="${head.cx}" y="${laid.lineBottom}" as="targetPoint"/>`,
      '          </mxGeometry>',
      '        </mxCell>',
    ].join('\n')),
    ...laid.arrows.map((arrow, index) => messageCell(arrow, index)),
  ];

  if (diagram.title.trim()) {
    cells.unshift([
      `        <mxCell id="title" value="${escapeXml(diagram.title.trim())}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontFamily=${FONT};fontSize=18;fontStyle=1;fontColor=#1A202C;" vertex="1" parent="1">`,
      `          <mxGeometry x="${MARGIN}" y="${MARGIN - 8}" width="${Math.max(240, laid.width - MARGIN * 2)}" height="28" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n'));
  }

  return [
    '<mxfile host="app.diagrams.net" agent="Inkline" version="24.7.17" type="device">',
    `  <diagram id="diagram-1" name="${escapeXml(pageName)}">`,
    `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${laid.width}" pageHeight="${laid.height}" math="0" shadow="0">`,
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

export function buildSequencePreviewSvg(diagram: SequenceDiagram): string {
  const laid = layoutSequence(diagram);
  const title = diagram.title.trim()
    ? `<text x="${laid.width / 2}" y="${MARGIN + 8}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="700" fill="#1A202C">${escapeXml(diagram.title.trim())}</text>`
    : '';
  const heads = laid.heads.map((head) => [
    `<rect x="${head.x}" y="${head.y}" width="${BOX_W}" height="${BOX_H}" rx="10" fill="#DAE8FC" stroke="#6C8EBF" stroke-width="1.5"/>`,
    `<text x="${head.cx}" y="${head.y + 26}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#1A365D">${escapeXml(wrapLabel(head.label, 18).replace('<br>', ' '))}</text>`,
  ].join('')).join('');
  const lines = laid.heads.map((head) => (
    `<line x1="${head.cx}" y1="${laid.lineTop}" x2="${head.cx}" y2="${laid.lineBottom}" stroke="#A0AEC0" stroke-width="1.4" stroke-dasharray="8 6"/>`
  )).join('');
  const arrows = laid.arrows.map((arrow) => svgArrow(arrow)).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${laid.width} ${laid.height}" width="${laid.width}" height="${laid.height}" role="img">`,
    '<defs><marker id="seq-block" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2D3748"/></marker>',
    '<marker id="seq-open" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#2D3748" stroke-width="1.6"/></marker></defs>',
    `<rect width="100%" height="100%" fill="#F8FAFC"/>`,
    title,
    lines,
    arrows,
    heads,
    '</svg>',
  ].join('');
}

type LaidHead = SequenceParticipant & { cellId: string; x: number; y: number; cx: number };
type LaidArrow = {
  kind: SequenceMessageKind;
  label?: string;
  points: Array<{ x: number; y: number }>;
};

function layoutSequence(diagram: SequenceDiagram) {
  const titleOffset = diagram.title.trim() ? TITLE_H : 0;
  const headY = snap(MARGIN + titleOffset);
  const indexOf = new Map(diagram.participants.map((item, index) => [item.id, index]));
  const heads: LaidHead[] = diagram.participants.map((item, index) => {
    const x = snap(MARGIN + index * (BOX_W + COL_GAP));
    return {
      ...item,
      cellId: `p-${item.id}`,
      x,
      y: headY,
      cx: snap(x + BOX_W / 2),
    };
  });

  const lineTop = snap(headY + BOX_H);
  let y = snap(lineTop + 28);
  const arrows: LaidArrow[] = [];
  for (const message of diagram.messages) {
    const from = indexOf.get(message.from) ?? 0;
    const to = indexOf.get(message.to) ?? 0;
    const kind = message.from === message.to ? 'self' : message.kind;
    if (kind === 'self') {
      const x = heads[from].cx;
      arrows.push({
        kind,
        label: message.label,
        points: [
          { x, y },
          { x: snap(x + SELF_BUMP), y },
          { x: snap(x + SELF_BUMP), y: snap(y + 18) },
          { x, y: snap(y + 18) },
        ],
      });
      y = snap(y + MSG_GAP + 8);
      continue;
    }
    arrows.push({
      kind,
      label: message.label,
      points: [
        { x: heads[from].cx, y },
        { x: heads[to].cx, y },
      ],
    });
    y = snap(y + MSG_GAP);
  }

  const lineBottom = snap(y + LIFELINE_PAD);
  const width = snap(MARGIN + diagram.participants.length * (BOX_W + COL_GAP) - COL_GAP + MARGIN);
  const height = snap(lineBottom + MARGIN);
  return { heads, arrows, lineTop, lineBottom, width, height };
}

function messageCell(arrow: LaidArrow, index: number): string {
  const dashed = arrow.kind === 'return' ? 'dashed=1;dashPattern=8 6;' : '';
  const open = arrow.kind === 'return' || arrow.kind === 'async';
  const arrowStyle = open
    ? 'endArrow=open;endFill=0;endSize=10;'
    : 'endArrow=block;endFill=1;endSize=8;';
  const label = arrow.label ? ` value="${escapeXml(arrow.label)}"` : '';
  const points = arrow.points;
  const source = points[0];
  const target = points[points.length - 1];
  const waypoints = points.slice(1, -1);
  const waypointXml = waypoints.length > 0
    ? [
      '            <Array as="points">',
      ...waypoints.map((point) => `              <mxPoint x="${point.x}" y="${point.y}"/>`),
      '            </Array>',
    ].join('\n')
    : '';
  return [
    `        <mxCell id="m-${index + 1}"${label} style="html=1;${arrowStyle}${dashed}strokeColor=#2D3748;strokeWidth=1.5;fontFamily=${FONT};fontSize=11;fontColor=#2D3748;labelBackgroundColor=#FFFFFF;rounded=0;" edge="1" parent="1">`,
    '          <mxGeometry relative="1" as="geometry">',
    `            <mxPoint x="${source.x}" y="${source.y}" as="sourcePoint"/>`,
    `            <mxPoint x="${target.x}" y="${target.y}" as="targetPoint"/>`,
    waypointXml,
    '          </mxGeometry>',
    '        </mxCell>',
  ].filter(Boolean).join('\n');
}

function svgArrow(arrow: LaidArrow): string {
  const dashed = arrow.kind === 'return' ? ' stroke-dasharray="8 6"' : '';
  const marker = arrow.kind === 'return' || arrow.kind === 'async' ? 'url(#seq-open)' : 'url(#seq-block)';
  const d = arrow.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const mid = arrow.points[Math.floor((arrow.points.length - 1) / 2)];
  const next = arrow.points[Math.min(arrow.points.length - 1, Math.floor((arrow.points.length - 1) / 2) + 1)] ?? mid;
  const labelX = (mid.x + next.x) / 2;
  const labelY = Math.min(mid.y, next.y) - 6;
  const label = arrow.label
    ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#2D3748">${escapeXml(arrow.label)}</text>`
    : '';
  return `<path d="${d}" fill="none" stroke="#2D3748" stroke-width="1.5"${dashed} marker-end="${marker}"/>${label}`;
}

function wrapLabel(label: string, maxLine: number): string {
  const text = label.trim();
  if (text.length <= maxLine) return text;
  return `${text.slice(0, maxLine - 1)}…`;
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
