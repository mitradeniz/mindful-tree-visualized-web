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
  private active: DrawingStroke | null = null;
  private pointerId: number | null = null;
  private tool: DrawingTool = 'select';
  color = '#149b83';
  width = 3;

  constructor(private host: HTMLElement,
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
      const p = this.clientPoint(event.clientX, event.clientY);
      if (!point.safeParse(p).success) return;
      this.active = { id: crypto.randomUUID(), tool: this.tool, color: this.color,
        width: Math.min(500, Math.max(0.1, this.width)), points: [p, p] };
      this.pointerId = event.pointerId;
      this.svg.setPointerCapture(event.pointerId);
      this.render();
    });
    this.svg.addEventListener('pointermove', (event) => {
      if (this.tool === 'eraser' && event.buttons === 1) { this.erase(event); return; }
      if (!this.active || event.pointerId !== this.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const p = this.clientPoint(event.clientX, event.clientY);
      if (!point.safeParse(p).success) return;
      if (this.active.tool === 'pen' && this.active.points.length < 2048) this.active.points.push(p);
      else this.active.points[this.active.points.length - 1] = p;
      this.render();
    });
    this.svg.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.pointerId || !this.active) return;
      event.stopPropagation();
      const stroke = this.active;
      this.cancel();
      if (stroke.points.some((p) => Math.hypot(p.x - stroke.points[0]!.x, p.y - stroke.points[0]!.y) > 0.5)) {
        this.strokes.push(stroke);
        this.onChange(this.strokes);
      }
      this.render();
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

  setSource(source: string): void { this.strokes = readDrawings(source); this.render(); }

  refreshViewport(): void {
    const rect = this.host.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) this.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  }

  private clientPoint(clientX: number, clientY: number): Point {
    const rect = this.host.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private cancel(): void {
    if (this.pointerId !== null && this.svg.hasPointerCapture(this.pointerId)) this.svg.releasePointerCapture(this.pointerId);
    this.pointerId = null; this.active = null; this.render();
  }

  private erase(event: PointerEvent): void {
    const target = event.target as Element;
    const id = target.getAttribute('data-stroke');
    if (!id) return;
    this.strokes = this.strokes.filter((stroke) => stroke.id !== id);
    this.onChange(this.strokes); this.render();
  }

  private render(): void {
    this.svg.replaceChildren();
    for (const stroke of [...this.strokes, ...(this.active ? [this.active] : [])]) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', drawingPath(stroke));
      path.setAttribute('stroke', stroke.color);
      path.setAttribute('stroke-width', String(stroke.width));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('data-stroke', stroke.id);
      this.svg.append(path);
    }
    this.refreshViewport();
  }
}
