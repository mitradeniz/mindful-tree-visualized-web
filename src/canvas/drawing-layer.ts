import { z } from 'zod';
import type { Point } from '../app/app-store';

export type DrawingTool = 'select' | 'pen' | 'eraser' | 'rectangle' | 'ellipse' | 'diamond' | 'line';
const prefix = '# branchscript-drawing ';
const point = z.object({ x: z.number().finite().min(-1e6).max(1e6), y: z.number().finite().min(-1e6).max(1e6) });
const strokeSchema = z.object({
  id: z.string().max(80),
  tool: z.enum(['pen', 'rectangle', 'ellipse', 'diamond', 'line']),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  width: z.number().positive().max(500),
  points: z.array(point).min(2).max(2048),
});
export type DrawingStroke = z.infer<typeof strokeSchema>;

function isValidPoint(value: Point): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y)
    && value.x >= -1e6 && value.x <= 1e6 && value.y >= -1e6 && value.y <= 1e6;
}

export function readDrawings(source: string): DrawingStroke[] {
  const strokes: DrawingStroke[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith(prefix) || line.length > 150_000) continue;
    try {
      const parsed = strokeSchema.safeParse(JSON.parse(line.slice(prefix.length)));
      if (parsed.success && strokes.length < 500) strokes.push(parsed.data);
    } catch { /* Invalid imported annotations are not executed or rendered. */ }
  }
  return strokes;
}

export function writeDrawings(source: string, strokes: DrawingStroke[]): string {
  const content = source.split(/\r?\n/).filter((line) => !line.startsWith(prefix)).join('\n').trimEnd();
  const valid = z.array(strokeSchema).max(500).parse(strokes);
  return `${content}\n${valid.map((stroke) => prefix + JSON.stringify(stroke)).join('\n')}\n`;
}

export function drawingPath(stroke: DrawingStroke): string {
  const a = stroke.points[0]!;
  const b = stroke.points.at(-1)!;
  const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x), height = Math.abs(a.y - b.y);
  if (stroke.tool === 'rectangle') return `M${left},${top}h${width}v${height}h${-width}Z`;
  if (stroke.tool === 'diamond') return `M${left + width / 2},${top}L${left + width},${top + height / 2}L${left + width / 2},${top + height}L${left},${top + height / 2}Z`;
  if (stroke.tool === 'ellipse') return `M${left},${top + height / 2}a${width / 2},${height / 2} 0 1 0 ${width},0a${width / 2},${height / 2} 0 1 0 ${-width},0`;
  return stroke.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
}

export class DrawingLayer {
  private readonly svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private strokes: DrawingStroke[] = [];
  private past: DrawingStroke[][] = [];
  private future: DrawingStroke[][] = [];
  private active: DrawingStroke | null = null;
  private pointerId: number | null = null;
  private lastClientPoint: Point | null = null;
  private renderFrame: number | null = null;
  private fullRenderQueued = false;
  private activeRenderQueued = false;
  private readonly pathById = new Map<string, SVGPathElement>();
  private tool: DrawingTool = 'select';
  color = '#149b83';
  width = 3;

  constructor(private host: HTMLElement, private toGraph: (x: number, y: number) => Point,
    private onChange: (strokes: DrawingStroke[]) => void) {
    this.svg.classList.add('drawing-layer');
    this.svg.setAttribute('aria-label', 'Drawing canvas');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    host.append(this.svg);
    this.svg.addEventListener('pointerdown', (event) => {
      if (this.pointerId !== null || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      if (this.tool === 'eraser') { this.erase(event); return; }
      if (this.tool === 'select' || this.strokes.length >= 500) return;
      const p = this.toGraph(event.clientX, event.clientY);
      if (!isValidPoint(p)) return;
      const unit = this.toGraph(event.clientX + this.width, event.clientY);
      const worldWidth = Math.abs(unit.x - p.x) || Math.abs(this.toGraph(event.clientX, event.clientY + this.width).y - p.y);
      this.active = { id: crypto.randomUUID(), tool: this.tool, color: this.color,
        width: Math.min(500, Math.max(0.1, worldWidth)), points: [p, p] };
      this.pointerId = event.pointerId;
      this.lastClientPoint = { x: event.clientX, y: event.clientY };
      this.svg.setPointerCapture(event.pointerId);
      this.queueRender(false);
    });
    this.svg.addEventListener('pointermove', (event) => {
      if (this.tool === 'eraser' && event.buttons === 1) { this.erase(event); return; }
      if (!this.active || event.pointerId !== this.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const clientPoint = { x: event.clientX, y: event.clientY };
      if (this.lastClientPoint && Math.hypot(clientPoint.x - this.lastClientPoint.x, clientPoint.y - this.lastClientPoint.y) < 0.75) return;
      const p = this.toGraph(event.clientX, event.clientY);
      if (!isValidPoint(p)) return;
      this.lastClientPoint = clientPoint;
      if (this.active.tool === 'pen' && this.active.points.length < 2048) this.active.points.push(p);
      else this.active.points[this.active.points.length - 1] = p;
      this.queueRender(false);
    });
    this.svg.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.pointerId || !this.active) return;
      event.stopPropagation();
      const stroke = this.active;
      this.cancel();
      if (stroke.points.some((p) => Math.hypot(p.x - stroke.points[0]!.x, p.y - stroke.points[0]!.y) > 0.5)) {
        this.commit([...this.strokes, stroke]);
      }
      this.queueRender(true);
    });
    this.svg.addEventListener('pointercancel', () => this.cancel());
    this.svg.addEventListener('dblclick', (event) => event.stopPropagation());
    new ResizeObserver(() => this.refreshViewport()).observe(host);
  }

  setTool(tool: DrawingTool): void {
    this.cancel(); this.tool = tool;
    this.svg.style.pointerEvents = tool === 'select' ? 'none' : 'auto';
    this.svg.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  }

  setSource(source: string): void { this.strokes = readDrawings(source); this.queueRender(true); }

  resetHistory(): void { this.past = []; this.future = []; }

  undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.strokes);
    this.strokes = previous;
    this.onChange(this.strokes);
    this.queueRender(true);
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.strokes);
    this.strokes = next;
    this.onChange(this.strokes);
    this.queueRender(true);
  }

  refreshViewport(): void {
    const rect = this.host.getBoundingClientRect();
    const a = this.toGraph(rect.left, rect.top), b = this.toGraph(rect.right, rect.bottom);
    if (b.x > a.x && b.y > a.y) this.svg.setAttribute('viewBox', `${a.x} ${a.y} ${b.x - a.x} ${b.y - a.y}`);
  }

  private cancel(): void {
    if (this.pointerId !== null && this.svg.hasPointerCapture(this.pointerId)) this.svg.releasePointerCapture(this.pointerId);
    this.pointerId = null; this.lastClientPoint = null; this.active = null; this.queueRender(true);
  }

  private erase(event: PointerEvent): void {
    const target = event.target as Element;
    const id = target.getAttribute('data-stroke');
    if (!id) return;
    const next = this.strokes.filter((stroke) => stroke.id !== id);
    if (next.length === this.strokes.length) return;
    this.commit(next);
  }

  private commit(next: DrawingStroke[]): void {
    this.past.push(this.strokes);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.strokes = next;
    this.onChange(this.strokes);
    this.queueRender(true);
  }

  private queueRender(full: boolean): void {
    this.fullRenderQueued ||= full;
    this.activeRenderQueued ||= !full;
    if (this.renderFrame !== null) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      const shouldRenderFull = this.fullRenderQueued;
      const shouldRenderActive = this.activeRenderQueued;
      this.fullRenderQueued = false;
      this.activeRenderQueued = false;
      if (shouldRenderFull) this.render();
      else if (shouldRenderActive && this.active) this.renderActive();
      this.refreshViewport();
    });
  }

  private render(): void {
    const activeId = this.active?.id;
    const visibleIds = new Set(this.strokes.map((stroke) => stroke.id));
    if (activeId) visibleIds.add(activeId);
    for (const [id, path] of this.pathById) {
      if (!visibleIds.has(id)) { path.remove(); this.pathById.delete(id); }
    }
    for (const stroke of this.strokes) this.renderStroke(stroke);
    if (this.active) this.renderStroke(this.active);
  }

  private renderActive(): void {
    if (this.active) this.renderStroke(this.active);
  }

  private renderStroke(stroke: DrawingStroke): void {
    let path = this.pathById.get(stroke.id);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('data-stroke', stroke.id);
      this.pathById.set(stroke.id, path);
      this.svg.append(path);
    }
    path.setAttribute('d', drawingPath(stroke));
    path.setAttribute('stroke', stroke.color);
    path.setAttribute('stroke-width', String(stroke.width));
  }
}
