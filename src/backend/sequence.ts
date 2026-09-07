export type SequenceMessageKind = 'sync' | 'async' | 'return' | 'self';
export type SequenceOpenType = 'alt' | 'loop' | 'opt' | 'par' | 'break';
export type SequenceMarkerType = SequenceOpenType | 'else' | 'end' | 'note' | 'activate' | 'deactivate';

export type SequenceParticipant = {
  id: string;
  label: string;
};

export type SequenceMessage = {
  type: 'message';
  from: string;
  to: string;
  label?: string;
  kind: SequenceMessageKind;
};

export type SequenceFragment = {
  type: SequenceMarkerType;
  label?: string;
  from?: string;
  to?: string;
};

export type SequenceStep = SequenceMessage | SequenceFragment;

export type SequenceDiagram = {
  title: string;
  participants: SequenceParticipant[];
  messages: SequenceStep[];
};

export const OPEN_FRAGMENT_TYPES: SequenceOpenType[] = ['alt', 'loop', 'opt', 'par', 'break'];

export function isSequenceMessage(step: SequenceStep): step is SequenceMessage {
  return step.type === 'message';
}

export function isOpenFragment(type: string): type is SequenceOpenType {
  return (OPEN_FRAGMENT_TYPES as string[]).includes(type);
}

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
  let depth = 0;
  for (const step of diagram.messages) {
    const pad = indent(depth);
    if (step.type === 'end') {
      depth = Math.max(0, depth - 1);
      lines.push(`${indent(depth)}end`);
      continue;
    }
    if (step.type === 'else') {
      const label = step.label ? ` ${seqText(step.label)}` : '';
      lines.push(`${indent(Math.max(0, depth - 1))}else${label}`);
      continue;
    }
    if (isOpenFragment(step.type)) {
      const label = step.label ? ` ${seqText(step.label)}` : '';
      lines.push(`${pad}${step.type}${label}`);
      depth += 1;
      continue;
    }
    if (step.type === 'note') {
      const left = actorName(diagram, step.from ?? '');
      const right = actorName(diagram, step.to ?? step.from ?? '');
      const over = left === right ? left : `${left},${right}`;
      lines.push(`${pad}note over ${over}:${seqText(step.label ?? '')}`);
      continue;
    }
    if (step.type === 'activate' || step.type === 'deactivate') {
      lines.push(`${pad}${step.type} ${actorName(diagram, step.from ?? '')}`);
      continue;
    }
    if (!isSequenceMessage(step)) continue;
    lines.push(`${pad}${messageLine(diagram, step)}`);
  }
  return `${lines.join('\n')}\n`;
}

function indent(depth: number): string {
  return '  '.repeat(depth);
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
  if (kind === 'return') return `${to}<--${from}:${label}`;
  if (kind === 'async') return `${from}->(1)${to}:${label}`;
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
const FRAME_HEAD = 26;
const FRAME_PAD = 10;
const ELSE_PAD = 18;
const FRAME_INSET = 12;
const NOTE_H = 36;

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
    ...laid.activations.map((bar, index) => [
      `        <mxCell id="act-${index + 1}" style="rounded=0;fillColor=#90CDF4;strokeColor=#2B6CB0;strokeWidth=1;" vertex="1" parent="1">`,
      `          <mxGeometry x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n')),
    ...laid.frames.flatMap((frame, index) => frameCells(frame, index)),
    ...laid.notes.map((note, index) => [
      `        <mxCell id="n-${index + 1}" value="${escapeXml(note.label)}" style="shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFFFCC;strokeColor=#D69E2E;fontFamily=${FONT};fontSize=11;fontColor=#2D3748;align=left;spacingLeft=8;spacingTop=4;" vertex="1" parent="1">`,
      `          <mxGeometry x="${note.x}" y="${note.y}" width="${note.width}" height="${note.height}" as="geometry"/>`,
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
  const activations = laid.activations.map((bar) => (
    `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="#90CDF4" stroke="#2B6CB0" stroke-width="1"/>`
  )).join('');
  const frames = laid.frames.map((frame) => svgFrame(frame)).join('');
  const notes = laid.notes.map((note) => [
    `<rect x="${note.x}" y="${note.y}" width="${note.width}" height="${note.height}" fill="#FFFFCC" stroke="#D69E2E" stroke-width="1.2"/>`,
    `<text x="${note.x + 8}" y="${note.y + 22}" font-family="${FONT}" font-size="11" fill="#2D3748">${escapeXml(wrapLabel(note.label, 42))}</text>`,
  ].join('')).join('');
  const arrows = laid.arrows.map((arrow) => svgArrow(arrow)).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${laid.width} ${laid.height}" width="${laid.width}" height="${laid.height}" role="img">`,
    '<defs><marker id="seq-block" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2D3748"/></marker>',
    '<marker id="seq-open" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#2D3748" stroke-width="1.6"/></marker></defs>',
    `<rect width="100%" height="100%" fill="#F8FAFC"/>`,
    title,
    lines,
    activations,
    frames,
    notes,
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
type LaidFrame = {
  kind: SequenceOpenType;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  elseDividers: Array<{ y: number; label?: string }>;
};
type LaidNote = { label: string; x: number; y: number; width: number; height: number };
type LaidActivation = { x: number; y: number; width: number; height: number };

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
  let lastY = y;
  const arrows: LaidArrow[] = [];
  const frames: LaidFrame[] = [];
  const notes: LaidNote[] = [];
  const activations: LaidActivation[] = [];
  const openActs = new Map<string, number[]>();
  const stack: Array<{
    kind: SequenceOpenType;
    label?: string;
    startY: number;
    elseDividers: Array<{ y: number; label?: string }>;
    depth: number;
  }> = [];

  const lastHead = heads[heads.length - 1];
  const fullX = snap(heads[0].x - 8);
  const fullW = snap(lastHead.x + BOX_W - heads[0].x + 16);

  for (const step of diagram.messages) {
    if (isOpenFragment(step.type)) {
      y = snap(y + 4);
      stack.push({
        kind: step.type,
        label: step.label,
        startY: y,
        elseDividers: [],
        depth: stack.length,
      });
      y = snap(y + FRAME_HEAD);
      lastY = y;
      continue;
    }
    if (step.type === 'else') {
      const open = stack[stack.length - 1];
      if (open) {
        y = snap(y + ELSE_PAD / 2);
        open.elseDividers.push({ y, label: step.label });
        y = snap(y + ELSE_PAD);
        lastY = y;
      }
      continue;
    }
    if (step.type === 'end') {
      const open = stack.pop();
      if (!open) continue;
      y = snap(y + FRAME_PAD);
      const inset = FRAME_INSET * open.depth;
      frames.push({
        kind: open.kind,
        label: open.label,
        x: snap(fullX + inset),
        y: open.startY,
        width: snap(fullW - inset * 2),
        height: Math.max(GRID * 3, snap(y - open.startY)),
        elseDividers: open.elseDividers,
      });
      y = snap(y + 6);
      lastY = y;
      continue;
    }
    if (step.type === 'note') {
      const a = indexOf.get(step.from ?? '') ?? 0;
      const b = indexOf.get(step.to ?? step.from ?? '') ?? a;
      const left = heads[Math.min(a, b)];
      const right = heads[Math.max(a, b)];
      notes.push({
        label: step.label ?? '',
        x: left.x,
        y,
        width: snap(right.x + BOX_W - left.x),
        height: NOTE_H,
      });
      y = snap(y + NOTE_H + 12);
      lastY = y;
      continue;
    }
    if (step.type === 'activate') {
      const id = step.from ?? '';
      const started = openActs.get(id) ?? [];
      started.push(lastY);
      openActs.set(id, started);
      continue;
    }
    if (step.type === 'deactivate') {
      closeActivation(step.from ?? '', y, heads, indexOf, openActs, activations);
      continue;
    }

    if (!isSequenceMessage(step)) continue;
    const from = indexOf.get(step.from) ?? 0;
    const to = indexOf.get(step.to) ?? 0;
    const kind = step.from === step.to ? 'self' : step.kind;
    if (kind === 'self') {
      const x = heads[from].cx;
      arrows.push({
        kind,
        label: step.label,
        points: [
          { x, y },
          { x: snap(x + SELF_BUMP), y },
          { x: snap(x + SELF_BUMP), y: snap(y + 18) },
          { x, y: snap(y + 18) },
        ],
      });
      y = snap(y + MSG_GAP + 8);
    } else {
      arrows.push({
        kind,
        label: step.label,
        points: [
          { x: heads[from].cx, y },
          { x: heads[to].cx, y },
        ],
      });
      y = snap(y + MSG_GAP);
    }
    lastY = y;
  }

  const lineBottom = snap(y + LIFELINE_PAD);
  for (const id of [...openActs.keys()]) {
    closeActivation(id, lineBottom - 8, heads, indexOf, openActs, activations);
  }
  const width = snap(MARGIN + diagram.participants.length * (BOX_W + COL_GAP) - COL_GAP + MARGIN);
  const height = snap(lineBottom + MARGIN);
  return { heads, arrows, frames, notes, activations, lineTop, lineBottom, width, height };
}

function closeActivation(
  id: string,
  endY: number,
  heads: LaidHead[],
  indexOf: Map<string, number>,
  openActs: Map<string, number[]>,
  activations: LaidActivation[],
) {
  const started = openActs.get(id);
  const startY = started?.pop();
  if (startY === undefined) return;
  const idx = indexOf.get(id) ?? 0;
  activations.push({
    x: heads[idx].cx - 5,
    y: startY,
    width: 10,
    height: Math.max(16, snap(endY - startY)),
  });
}

function frameHeader(frame: LaidFrame): string {
  const condition = frame.label ? ` [${wrapLabel(frame.label, 22)}]` : '';
  return `${frame.kind}${condition}`;
}

function frameCells(frame: LaidFrame, index: number): string[] {
  const header = frameHeader(frame);
  const headerW = Math.min(frame.width - 8, Math.max(72, header.length * 7 + 16));
  const cells = [
    [
      `        <mxCell id="f-${index + 1}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#6B46C1;strokeWidth=1.4;dashed=0;" vertex="1" parent="1">`,
      `          <mxGeometry x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n'),
    [
      `        <mxCell id="f-${index + 1}-h" value="${escapeXml(header)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E9D8FD;strokeColor=#6B46C1;strokeWidth=1.2;fontFamily=${FONT};fontSize=11;fontColor=#553C9A;align=left;verticalAlign=middle;spacingLeft=6;" vertex="1" parent="1">`,
      `          <mxGeometry x="${frame.x}" y="${frame.y}" width="${headerW}" height="22" as="geometry"/>`,
      '        </mxCell>',
    ].join('\n'),
  ];
  for (const [dividerIndex, divider] of frame.elseDividers.entries()) {
    const label = divider.label ? ` [${wrapLabel(divider.label, 22)}]` : '';
    cells.push([
      `        <mxCell id="f-${index + 1}-e${dividerIndex + 1}" value="else${escapeXml(label)}" style="endArrow=none;html=1;dashed=1;dashPattern=8 6;strokeColor=#6B46C1;strokeWidth=1.2;fontFamily=${FONT};fontSize=11;fontColor=#553C9A;labelBackgroundColor=#F8FAFC;align=left;" edge="1" parent="1">`,
      '          <mxGeometry relative="1" as="geometry">',
      `            <mxPoint x="${frame.x}" y="${divider.y}" as="sourcePoint"/>`,
      `            <mxPoint x="${frame.x + frame.width}" y="${divider.y}" as="targetPoint"/>`,
      '          </mxGeometry>',
      '        </mxCell>',
    ].join('\n'));
  }
  return cells;
}

function svgFrame(frame: LaidFrame): string {
  const header = frameHeader(frame);
  const headerW = Math.min(frame.width - 8, Math.max(72, header.length * 7 + 16));
  const dividers = frame.elseDividers.map((divider) => {
    const label = divider.label ? ` [${wrapLabel(divider.label, 22)}]` : '';
    return [
      `<line x1="${frame.x}" y1="${divider.y}" x2="${frame.x + frame.width}" y2="${divider.y}" stroke="#6B46C1" stroke-width="1.2" stroke-dasharray="8 6"/>`,
      `<text x="${frame.x + 8}" y="${divider.y - 4}" font-family="${FONT}" font-size="11" fill="#553C9A">else${escapeXml(label)}</text>`,
    ].join('');
  }).join('');
  return [
    `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="none" stroke="#6B46C1" stroke-width="1.4"/>`,
    `<rect x="${frame.x}" y="${frame.y}" width="${headerW}" height="22" fill="#E9D8FD" stroke="#6B46C1" stroke-width="1.2"/>`,
    `<text x="${frame.x + 8}" y="${frame.y + 16}" font-family="${FONT}" font-size="11" fill="#553C9A">${escapeXml(header)}</text>`,
    dividers,
  ].join('');
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
