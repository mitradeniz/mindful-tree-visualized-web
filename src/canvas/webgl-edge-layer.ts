import type { DiagramView, GraphDocument, GraphEdge } from "../domain/graph-document";

export interface EdgeNodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface EdgeLayerResolvers {
  nodeBounds: (nodeId: string) => EdgeNodeBounds | null;
  matrix: () => ViewportMatrix;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface EdgePath {
  edge: GraphEdge;
  points: ScreenPoint[];
  color: readonly [number, number, number];
  alpha: number;
  width: number;
  active: boolean;
}

const webglEdgeThreshold = 90;
const webglNodeThreshold = 140;
const curveSegments = 12;
const vertexStride = 6;

export interface EdgeLabelMetrics {
  visible: boolean;
  fontSize: number;
  horizontalPadding: number;
  pillHeight: number;
  maxWidth: number;
  fade: number;
}

export function edgeLabelMetrics(zoom: number): EdgeLabelMetrics {
  const safeZoom = Math.max(0, zoom);
  const fontSize = Math.min(12, Math.max(7, 6.4 + safeZoom * 12));
  return {
    visible: safeZoom >= 0.045,
    fontSize,
    horizontalPadding: Math.min(8, Math.max(4, 3.5 + safeZoom * 8)),
    pillHeight: fontSize + Math.min(9, Math.max(6, 5 + safeZoom * 5)),
    maxWidth: Math.min(160, Math.max(60, 48 + safeZoom * 140)),
    fade: Math.min(1, Math.max(0.4, (safeZoom - 0.035) / 0.12)),
  };
}

export function shouldUseWebGLEdges(nodeCount: number, edgeCount: number): boolean {
  return edgeCount >= webglEdgeThreshold || nodeCount >= webglNodeThreshold;
}

function edgeColor(edge: GraphEdge, view: DiagramView): string {
  if (edge.kind === "reference") return "#b88ed9";
  if (view === "neural") return "#719ce6";
  if (view === "logic") return "#d09b56";
  if (view === "algorithm") return "#b5965f";
  if (view === "data") return "#6f9f91";
  if (view === "tree") return "#67a67b";
  return "#718d7d";
}

function hexToRgb(color: string): readonly [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

function transformPoint(point: ScreenPoint, matrix: ViewportMatrix): ScreenPoint {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

function boundaryPoint(bounds: EdgeNodeBounds, target: ScreenPoint): ScreenPoint {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return center;
  const horizontal = Math.abs(dx) < 0.001 ? Number.POSITIVE_INFINITY : bounds.width / 2 / Math.abs(dx);
  const vertical = Math.abs(dy) < 0.001 ? Number.POSITIVE_INFINITY : bounds.height / 2 / Math.abs(dy);
  const scale = Math.min(horizontal, vertical);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function cubicPoint(
  start: ScreenPoint,
  controlA: ScreenPoint,
  controlB: ScreenPoint,
  end: ScreenPoint,
  time: number,
): ScreenPoint {
  const inverse = 1 - time;
  const inverseSquared = inverse * inverse;
  const timeSquared = time * time;
  return {
    x: inverseSquared * inverse * start.x
      + 3 * inverseSquared * time * controlA.x
      + 3 * inverse * timeSquared * controlB.x
      + timeSquared * time * end.x,
    y: inverseSquared * inverse * start.y
      + 3 * inverseSquared * time * controlA.y
      + 3 * inverse * timeSquared * controlB.y
      + timeSquared * time * end.y,
  };
}

function edgeCurve(source: EdgeNodeBounds, target: EdgeNodeBounds, matrix: ViewportMatrix): ScreenPoint[] {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const start = boundaryPoint(source, targetCenter);
  const end = boundaryPoint(target, sourceCenter);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const controlA = horizontal
    ? { x: start.x + dx * 0.48, y: start.y }
    : { x: start.x, y: start.y + dy * 0.48 };
  const controlB = horizontal
    ? { x: end.x - dx * 0.48, y: end.y }
    : { x: end.x, y: end.y - dy * 0.48 };
  return Array.from({ length: curveSegments + 1 }, (_, index) =>
    transformPoint(cubicPoint(start, controlA, controlB, end, index / curveSegments), matrix));
}

function pushVertex(
  vertices: number[],
  point: ScreenPoint,
  color: readonly [number, number, number],
  alpha: number,
): void {
  vertices.push(point.x, point.y, color[0], color[1], color[2], alpha);
}

function pushLineSegment(vertices: number[], path: EdgePath, start: ScreenPoint, end: ScreenPoint): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return;
  const halfWidth = path.width / 2;
  const nx = (-dy / length) * halfWidth;
  const ny = (dx / length) * halfWidth;
  const a = { x: start.x + nx, y: start.y + ny };
  const b = { x: start.x - nx, y: start.y - ny };
  const c = { x: end.x + nx, y: end.y + ny };
  const d = { x: end.x - nx, y: end.y - ny };
  pushVertex(vertices, a, path.color, path.alpha);
  pushVertex(vertices, b, path.color, path.alpha);
  pushVertex(vertices, c, path.color, path.alpha);
  pushVertex(vertices, c, path.color, path.alpha);
  pushVertex(vertices, b, path.color, path.alpha);
  pushVertex(vertices, d, path.color, path.alpha);
}

function pushArrow(vertices: number[], path: EdgePath): void {
  const end = path.points.at(-1);
  const previous = path.points.at(-2);
  if (!end || !previous) return;
  const dx = end.x - previous.x;
  const dy = end.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return;
  const ux = dx / length;
  const uy = dy / length;
  const arrowLength = path.active ? 12 : 9;
  const arrowWidth = path.active ? 5.5 : 4.2;
  const base = { x: end.x - ux * arrowLength, y: end.y - uy * arrowLength };
  const left = { x: base.x - uy * arrowWidth, y: base.y + ux * arrowWidth };
  const right = { x: base.x + uy * arrowWidth, y: base.y - ux * arrowWidth };
  pushVertex(vertices, end, path.color, path.alpha);
  pushVertex(vertices, left, path.color, path.alpha);
  pushVertex(vertices, right, path.color, path.alpha);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `
    attribute vec2 a_position;
    attribute vec4 a_color;
    uniform vec2 u_resolution;
    varying vec4 v_color;
    void main() {
      vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_color = a_color;
    }
  `);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec4 v_color;
    void main() {
      gl_FragColor = v_color;
    }
  `);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

export class WebGLEdgeLayer {
  readonly available: boolean;
  private readonly canvas: HTMLCanvasElement;
  private readonly labelCanvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext | null;
  private readonly labels: CanvasRenderingContext2D | null;
  private readonly program: WebGLProgram | null;
  private readonly buffer: WebGLBuffer | null;
  private document: GraphDocument | null = null;
  private enabled = false;
  private frame: number | null = null;
  private pathPairs = new Set<string>();
  private hasPath = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly resolvers: EdgeLayerResolvers,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "webgl-edge-layer";
    this.canvas.setAttribute("aria-hidden", "true");
    this.labelCanvas = document.createElement("canvas");
    this.labelCanvas.className = "webgl-edge-label-layer";
    this.labelCanvas.setAttribute("aria-hidden", "true");
    this.container.prepend(this.labelCanvas);
    this.container.prepend(this.canvas);
    this.gl = this.canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    this.labels = this.labelCanvas.getContext("2d");
    this.program = this.gl ? createProgram(this.gl) : null;
    this.buffer = this.gl?.createBuffer() ?? null;
    this.available = Boolean(this.gl && this.program && this.buffer && this.labels);
    this.setEnabled(false);
  }

  setScene(document: GraphDocument, enabled: boolean): void {
    if (this.document?.id !== document.id) {
      this.pathPairs.clear();
      this.hasPath = false;
    }
    this.document = document;
    this.setEnabled(enabled && this.available);
    this.scheduleDraw();
  }

  setHighlight(path: string[]): void {
    this.pathPairs = new Set(path.slice(1).map((target, index) => `${path[index]}:${target}`));
    this.hasPath = path.length > 0;
    this.scheduleDraw();
  }

  refreshTheme(): void {
    this.scheduleDraw();
  }

  scheduleDraw(): void {
    if (!this.enabled || this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.draw();
    });
  }

  dispose(): void {
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
    if (this.gl && this.buffer) this.gl.deleteBuffer(this.buffer);
    this.canvas.remove();
    this.labelCanvas.remove();
  }

  private setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.canvas.hidden = !enabled;
    this.labelCanvas.hidden = !enabled;
    this.container.classList.toggle("webgl-edges-active", enabled);
    if (!enabled) this.clear();
  }

  private resize(): { width: number; height: number; ratio: number } | null {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.labelCanvas.width = pixelWidth;
      this.labelCanvas.height = pixelHeight;
    }
    return { width, height, ratio };
  }

  private edgePaths(document: GraphDocument): EdgePath[] {
    const matrix = this.resolvers.matrix();
    return document.edges.flatMap((edge) => {
      const source = this.resolvers.nodeBounds(edge.source);
      const target = this.resolvers.nodeBounds(edge.target);
      if (!source || !target) return [];
      const active = this.pathPairs.has(`${edge.source}:${edge.target}`);
      const alpha = this.hasPath ? (active ? 1 : 0.08) : document.view === "neural" ? 0.82 : 0.92;
      const width = active ? 3.4 : edge.kind === "reference" ? 1.5 : document.view === "neural" ? 1.4 : 2;
      return [{ edge, points: edgeCurve(source, target, matrix), color: hexToRgb(edgeColor(edge, document.view)), alpha, width, active }];
    });
  }

  private draw(): void {
    if (!this.enabled || !this.document || !this.gl || !this.program || !this.buffer || !this.labels) return;
    const viewport = this.resize();
    if (!viewport) return;
    const paths = this.edgePaths(this.document);
    const vertices: number[] = [];
    for (const path of paths) {
      for (let index = 1; index < path.points.length; index += 1) {
        const start = path.points[index - 1];
        const end = path.points[index];
        if (start && end) pushLineSegment(vertices, path, start, end);
      }
      pushArrow(vertices, path);
    }

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    const position = gl.getAttribLocation(this.program, "a_position");
    const color = gl.getAttribLocation(this.program, "a_color");
    const resolution = gl.getUniformLocation(this.program, "u_resolution");
    if (position < 0 || color < 0 || !resolution) {
      this.clear();
      return;
    }
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, vertexStride * 4, 0);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, vertexStride * 4, 2 * 4);
    gl.uniform2f(resolution, viewport.width, viewport.height);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / vertexStride);

    this.drawLabels(paths, viewport.width, viewport.height, viewport.ratio, this.resolvers.matrix());
  }

  private drawLabels(
    paths: EdgePath[],
    width: number,
    height: number,
    ratio: number,
    matrix: ViewportMatrix,
  ): void {
    const context = this.labels;
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const zoom = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c));
    const metrics = edgeLabelMetrics(zoom);
    if (!metrics.visible) return;
    const { fontSize, horizontalPadding, pillHeight } = metrics;
    const radius = pillHeight / 2;
    context.font = `700 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const light = document.documentElement.dataset.theme === "light";
    const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    const orderedPaths = [...paths].sort((left, right) => Number(right.active) - Number(left.active));
    for (const path of orderedPaths) {
      const label = path.edge.label;
      if (!label || path.alpha < 0.12) continue;
      const point = path.points[Math.round((path.points.length - 1) * 0.55)];
      if (!point || point.x < -80 || point.x > width + 80 || point.y < -30 || point.y > height + 30) continue;
      const textWidth = Math.min(metrics.maxWidth, context.measureText(label).width + horizontalPadding * 2);
      const bounds = {
        left: point.x - textWidth / 2,
        top: point.y - pillHeight / 2,
        right: point.x + textWidth / 2,
        bottom: point.y + pillHeight / 2,
      };
      const overlaps = occupied.some((item) =>
        bounds.left < item.right + 2
        && bounds.right > item.left - 2
        && bounds.top < item.bottom + 2
        && bounds.bottom > item.top - 2);
      if (overlaps && !path.active) continue;
      occupied.push(bounds);
      context.globalAlpha = path.alpha * metrics.fade;
      context.fillStyle = light ? "rgba(237, 244, 241, 0.94)" : "rgba(22, 32, 25, 0.94)";
      context.strokeStyle = `rgb(${Math.round(path.color[0] * 255)} ${Math.round(path.color[1] * 255)} ${Math.round(path.color[2] * 255)})`;
      context.lineWidth = Math.max(0.5, Math.min(1.25, zoom));
      context.beginPath();
      context.roundRect(bounds.left, bounds.top, textWidth, pillHeight, radius);
      context.fill();
      context.stroke();
      context.fillStyle = light ? "#20362e" : "#eaf3ec";
      context.fillText(label, point.x, point.y, Math.max(1, textWidth - horizontalPadding * 2));
    }
    context.globalAlpha = 1;
  }

  private clear(): void {
    this.gl?.clear(this.gl.COLOR_BUFFER_BIT);
    this.labels?.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);
  }
}
