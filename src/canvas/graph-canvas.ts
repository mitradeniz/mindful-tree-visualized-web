import { Graph, Node } from "@antv/x6";
import { History } from "@antv/x6-plugin-history";
import { Keyboard } from "@antv/x6-plugin-keyboard";
import { MiniMap } from "@antv/x6-plugin-minimap";
import { Selection } from "@antv/x6-plugin-selection";
import type { LayoutDirection, Point } from "../app/app-store";
import type { DiagramView, GraphDocument, GraphEdge, GraphNode, NodeKind } from "../domain/graph-document";
import { t } from "../i18n";
import { dataFields, dataItems } from "./data-structure";
import { calculateLayout, sizeForNode, type NodeSize } from "./layout";
import { intersectsWithOverscan, maxCanvasScale, minCanvasScale, nextWheelZoomScale } from "./navigation";
import { matchingNodeIds, nodeMatchesSearch } from "./search";

interface CanvasCallbacks {
  onSelect: (nodeIds: string[]) => void;
  onPositionsChange: (positions: Record<string, Point>) => void;
  onQuickAdd: () => void;
  onCanvasTap: (position: Point) => void;
  onNodeEdit: (nodeId: string) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onNodeTitleChange: (nodeId: string, label: string) => void;
  onNodeContentChange: (nodeId: string, field: "text" | "answer", value: string) => void;
  onNodesDelete: (nodeIds: string[]) => void;
  onNodeResize: (nodeId: string, size: NodeSize, position: Point) => void;
  onContextMenu: (request: { clientX: number; clientY: number; nodeId: string | null }) => void;
}

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface ResizeSession {
  pointerId: number;
  nodeId: string;
  direction: ResizeDirection;
  clientX: number;
  clientY: number;
  position: Point;
  size: NodeSize;
  nextPosition: Point;
  nextSize: NodeSize;
  square: boolean;
}

interface NodePalette {
  fill: string;
  stroke: string;
  accent: string;
}

const nodeColors: Record<NodeKind, NodePalette> = {
  topic: { fill: "#202b27", stroke: "#4f806f", accent: "#91b9aa" },
  question: { fill: "#22292d", stroke: "#557682", accent: "#9eb5be" },
  response: { fill: "#2c2922", stroke: "#8a744c", accent: "#c0ae88" },
  followup: { fill: "#29262f", stroke: "#766786", accent: "#b1a4c0" },
  note: { fill: "#292824", stroke: "#747168", accent: "#aaa79d" },
  text: { fill: "#282828", stroke: "#7b817d", accent: "#c5cbc7" },
  example: { fill: "#2d2529", stroke: "#80616e", accent: "#b99aa7" },
  input: { fill: "#1f2b2a", stroke: "#4f7d77", accent: "#94b8b3" },
  layer: { fill: "#22292f", stroke: "#596f83", accent: "#9fadb9" },
  neuron: { fill: "#222832", stroke: "#5f7493", accent: "#a6b5ca" },
  process: { fill: "#202a26", stroke: "#4d7565", accent: "#92b2a4" },
  decision: { fill: "#2c2921", stroke: "#8a744b", accent: "#c0ae86" },
  outcome: { fill: "#29252d", stroke: "#75627f", accent: "#ad9db5" },
  output: { fill: "#29252e", stroke: "#725f80", accent: "#aa9ab8" },
  start: { fill: "#1f2b28", stroke: "#4f806f", accent: "#91b9aa" },
  function: { fill: "#22292f", stroke: "#59778a", accent: "#9fb5c1" },
  operation: { fill: "#202a26", stroke: "#4d7565", accent: "#92b2a4" },
  condition: { fill: "#2c2921", stroke: "#8a744b", accent: "#c0ae86" },
  loop: { fill: "#29262f", stroke: "#766786", accent: "#b1a4c0" },
  return: { fill: "#29252e", stroke: "#725f80", accent: "#aa9ab8" },
  array: { fill: "#20282c", stroke: "#527481", accent: "#9bb4bd" },
  item: { fill: "#252925", stroke: "#607760", accent: "#a4b5a4" },
  stack: { fill: "#29262e", stroke: "#746484", accent: "#afa0bb" },
  queue: { fill: "#2b2822", stroke: "#826f4c", accent: "#bdaa86" },
  list: { fill: "#202a26", stroke: "#4d7565", accent: "#92b2a4" },
  record: { fill: "#25292d", stroke: "#5c7082", accent: "#a0afba" },
  pointer: { fill: "#2c2528", stroke: "#805e6b", accent: "#b99aa5" },
};

const dataKinds = new Set<NodeKind>(["array", "item", "stack", "queue", "list", "record", "pointer"]);
const touchTapDistance = 10;
const touchDoubleTapDelay = 320;
const virtualNodeThreshold = 200;
const minBoxWidth = 120;
const minBoxHeight = 60;
const maxBoxWidth = 1_200;
const maxBoxHeight = 900;
const lightCanvasColor = "#edf4f1";
const resizeDirections: ResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const customNodeColors = {
  green: { fill: "#202b27", stroke: "#4f806f", accent: "#91b9aa" },
  blue: { fill: "#22292f", stroke: "#59778a", accent: "#9fb5c1" },
  amber: { fill: "#2c2921", stroke: "#8a744b", accent: "#c0ae86" },
  purple: { fill: "#29252f", stroke: "#766586", accent: "#afa0bd" },
  red: { fill: "#2e2525", stroke: "#875f5a", accent: "#bd9a94" },
  gray: { fill: "#282828", stroke: "#686868", accent: "#aaaaaa" },
};

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = l - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function paletteForNode(node: GraphNode): NodePalette {
  if (node.color) return customNodeColors[node.color];
  if (!node.category) return nodeColors[node.kind];
  let hash = 2_166_136_261;
  for (const character of Array.from(node.category.trim().toLocaleLowerCase())) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16_777_619) >>> 0;
  }
  const hue = (hash / 4_294_967_295) * 360;
  return {
    fill: hslToHex(hue, 18, 15),
    stroke: hslToHex(hue, 36, 42),
    accent: hslToHex(hue, 32, 70),
  };
}

function categoryBadgeWidth(node: GraphNode, availableWidth: number): number {
  if (!node.category) return 0;
  return Math.min(availableWidth, Math.max(58, Math.round(node.category.length * 6.1 + 20)));
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

function translucentColor(color: string, opacity: number): string {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  const hex = match?.[1];
  if (!hex) return color;
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgb(${red} ${green} ${blue} / ${opacity})`;
}

function compositeColor(foreground: string, background: string, opacity: number): string {
  const foregroundHex = /^#([0-9a-f]{6})$/i.exec(foreground)?.[1];
  const backgroundHex = /^#([0-9a-f]{6})$/i.exec(background)?.[1];
  if (!foregroundHex || !backgroundHex) return foreground;
  const foregroundValue = Number.parseInt(foregroundHex, 16);
  const backgroundValue = Number.parseInt(backgroundHex, 16);
  const channel = (shift: number) => Math.round(
    ((foregroundValue >> shift) & 0xff) * opacity + ((backgroundValue >> shift) & 0xff) * (1 - opacity),
  );
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

function nodeFill(colors: NodePalette): string {
  if (document.documentElement.dataset.theme !== "light") return colors.fill;
  return compositeColor(colors.stroke, lightCanvasColor, 0.16);
}

function fitDataCellText(value: string, width: number, fontSize: number): string {
  const limit = Math.max(3, Math.floor((width - 16) / (fontSize * 0.62)));
  return value.length > limit ? `${value.slice(0, Math.max(1, limit - 1))}…` : value;
}

function fontFamilyForNode(node: GraphNode): string {
  return {
    sans: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    serif: "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  }[node.fontFamily ?? "sans"];
}

function fontWeightForNode(node: GraphNode, fallback: number): number {
  return { regular: 450, medium: 650, bold: 800 }[node.fontWeight ?? "medium"] ?? fallback;
}

function textPositionForNode(node: GraphNode, width: number, padding: number): { x: number; anchor: "start" | "middle" | "end" } {
  if (node.textAlign === "center") return { x: width / 2, anchor: "middle" };
  if (node.textAlign === "right") return { x: width - padding, anchor: "end" };
  return { x: padding, anchor: "start" };
}

export class GraphCanvas {
  private readonly graph: Graph;
  private readonly history: History;
  private readonly selection: Selection;
  private readonly keyboard: Keyboard;
  private readonly minimap: MiniMap;
  private readonly resizeFrame: HTMLDivElement;
  private readonly inlineTitleEditor: HTMLInputElement;
  private readonly inlineContentEditor: HTMLTextAreaElement;
  private document: GraphDocument | null = null;
  private edgeVisibilityFrame: number | null = null;
  private zoomFrame: number | null = null;
  private pendingZoom: { scale: number; center: Point } | null = null;
  private readonly activeTouches = new Map<number, Point>();
  private touchStart: { pointerId: number; x: number; y: number; nodeId: string | null; moved: boolean } | null = null;
  private lastTouchTap: { nodeId: string | null; timestamp: number } | null = null;
  private touchFrame: number | null = null;
  private pendingTouchTransform: { dx: number; dy: number; scale: number | null; center: Point | null } | null = null;
  private resizeFrameId: number | null = null;
  private selectedResizeNodeId: string | null = null;
  private resizeSession: ResizeSession | null = null;
  private minimapPointerId: number | null = null;
  private minimapMouseDragging = false;
  private editingLocked = false;
  private inlineTitleNodeId: string | null = null;
  private inlineContentNodeId: string | null = null;
  private inlineContentField: "text" | "answer" | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly minimapContainer: HTMLElement,
    private readonly callbacks: CanvasCallbacks,
  ) {
    this.graph = new Graph({
      container: this.container,
      autoResize: true,
      background: { color: "transparent" },
      preventDefaultDblClick: true,
      virtual: true,
      grid: {
        visible: true,
        type: "dot",
        args: { color: "#385144", thickness: 1 },
      },
      panning: { enabled: true, eventTypes: ["leftMouseDown"] },
      mousewheel: {
        enabled: false,
        modifiers: ["ctrl", "meta"],
        factor: 1.05,
        minScale: minCanvasScale,
        maxScale: maxCanvasScale,
      },
      interacting: {
        edgeLabelMovable: false,
        edgeMovable: false,
        vertexMovable: false,
        magnetConnectable: true,
      },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        allowEdge: false,
        allowPort: true,
        highlight: true,
        snap: { radius: 24 },
        validateConnection: ({ sourceCell, targetCell }) => sourceCell !== targetCell,
      },
    });

    this.history = new History({ enabled: true, stackSize: 80 });
    this.selection = new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      modifiers: ["meta"],
      movable: true,
      showNodeSelectionBox: true,
      showEdgeSelectionBox: false,
    });
    this.keyboard = new Keyboard({ enabled: true, global: false });

    this.graph.use(this.history);
    this.graph.use(this.selection);
    this.graph.use(this.keyboard);
    this.minimap = new MiniMap({
      container: this.minimapContainer,
      width: 172,
      height: 108,
      padding: 12,
      scalable: false,
    });
    this.graph.use(this.minimap);
    this.minimapContainer.title = "Click or drag to move around the canvas";
    this.minimapContainer.addEventListener("pointerdown", this.onMinimapPointerDown, { capture: true, passive: false });
    this.minimapContainer.addEventListener("pointermove", this.onMinimapPointerMove, { capture: true, passive: false });
    this.minimapContainer.addEventListener("pointerup", this.onMinimapPointerUp, { capture: true, passive: false });
    this.minimapContainer.addEventListener("pointercancel", this.onMinimapPointerUp, { capture: true, passive: false });
    this.minimapContainer.addEventListener("mousedown", this.onMinimapMouseDown, { capture: true, passive: false });

    this.resizeFrame = window.document.createElement("div");
    this.resizeFrame.className = "node-resize-frame";
    this.resizeFrame.hidden = true;
    for (const direction of resizeDirections) {
      const handle = window.document.createElement("button");
      handle.type = "button";
      handle.className = `node-resize-handle resize-${direction}`;
      handle.dataset.resizeHandle = direction;
      handle.setAttribute("aria-label", `Resize box ${direction}`);
      handle.addEventListener("pointerdown", this.onResizeHandlePointerDown);
      this.resizeFrame.append(handle);
    }
    this.container.append(this.resizeFrame);

    this.inlineTitleEditor = window.document.createElement("input");
    this.inlineTitleEditor.type = "text";
    this.inlineTitleEditor.className = "node-title-inline-editor";
    this.inlineTitleEditor.hidden = true;
    this.inlineTitleEditor.maxLength = 160;
    this.inlineTitleEditor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.commitInlineTitleEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelInlineTitleEdit();
      }
    });
    this.inlineTitleEditor.addEventListener("blur", () => this.commitInlineTitleEdit());
    this.container.append(this.inlineTitleEditor);

    this.inlineContentEditor = window.document.createElement("textarea");
    this.inlineContentEditor.className = "node-content-inline-editor";
    this.inlineContentEditor.hidden = true;
    this.inlineContentEditor.maxLength = 600;
    this.inlineContentEditor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelInlineContentEdit();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.commitInlineContentEdit();
      }
    });
    this.inlineContentEditor.addEventListener("blur", () => this.commitInlineContentEdit());
    this.container.append(this.inlineContentEditor);

    this.container.addEventListener("wheel", this.onCanvasWheel, { passive: false });
    this.container.addEventListener("pointerdown", this.onCanvasPointerDown, { capture: true, passive: false });
    this.container.addEventListener("pointermove", this.onCanvasPointerMove, { capture: true, passive: false });
    this.container.addEventListener("pointerup", this.onCanvasPointerUp, { capture: true, passive: false });
    this.container.addEventListener("pointercancel", this.onCanvasPointerCancel, { capture: true, passive: false });
    window.addEventListener("resize", this.scheduleResizeFrame);
    this.graph.on("scale", this.scheduleViewportOverlays);
    this.graph.on("translate", this.scheduleViewportOverlays);
    this.graph.on("blank:click", ({ e }) => {
      this.callbacks.onCanvasTap(this.clientPointToGraph(e.clientX, e.clientY));
    });
    this.graph.on("blank:dblclick", () => {
      if (!this.editingLocked) this.callbacks.onQuickAdd();
    });
    this.graph.on("node:dblclick", ({ e, node }) => {
      if (this.editingLocked) return;
      e.preventDefault();
      e.stopPropagation();
      if (this.isNodeTitleTarget(e.target)) {
        this.focusNode(node.id, false);
        this.openInlineTitleEditor(node);
        return;
      }
      const sourceNode = this.document?.nodes.find((candidate) => candidate.id === node.id);
      const contentField = sourceNode ? this.nodeContentField(e.target, sourceNode) : null;
      if (contentField) {
        this.focusNode(node.id, false);
        this.openInlineContentEditor(node, contentField);
        return;
      }
      this.focusNode(node.id, true);
      this.zoomToNode(node);
    });
    this.graph.on("node:click", ({ e, node }) => {
      if (this.editingLocked || this.isConnectionPortTarget(e.target)) return;
      this.focusNode(node.id, false);
      this.callbacks.onNodeEdit(node.id);
    });
    this.graph.on("edge:connected", ({ edge }) => {
      if (this.editingLocked || edge.getData<{ initial?: boolean }>()?.initial) {
        edge.remove();
        return;
      }
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();
      edge.remove();
      if (!sourceId || !targetId || sourceId === targetId) return;
      this.callbacks.onConnect(sourceId, targetId);
    });
    this.graph.on("blank:contextmenu", ({ e }) => {
      if (this.editingLocked) return;
      this.callbacks.onContextMenu({ clientX: e.clientX, clientY: e.clientY, nodeId: null });
    });
    this.graph.on("node:contextmenu", ({ e, node }) => {
      if (this.editingLocked) return;
      this.focusNode(node.id, false);
      this.callbacks.onContextMenu({ clientX: e.clientX, clientY: e.clientY, nodeId: node.id });
    });
    this.graph.on("node:moved", () => {
      this.emitPositions();
      this.scheduleViewportOverlays();
    });
    this.graph.on("node:change:position", () => this.scheduleResizeFrame());
    this.selection.on("selection:changed", () => {
      const nodeIds = this.selection
        .getSelectedCells()
        .filter((cell) => cell.isNode())
        .map((cell) => cell.id);
      this.selectedResizeNodeId = !this.editingLocked && nodeIds.length === 1 ? nodeIds[0] ?? null : null;
      this.scheduleResizeFrame();
      this.callbacks.onSelect(nodeIds);
    });
    this.history.on("change", () => {
      this.emitPositions();
      this.scheduleResizeFrame();
    });

    this.keyboard.bindKey(["meta+z", "ctrl+z"], () => {
      this.history.undo();
      return false;
    });
    this.keyboard.bindKey(["meta+shift+z", "ctrl+shift+z"], () => {
      this.history.redo();
      return false;
    });
    this.keyboard.bindKey(["backspace", "delete"], () => {
      if (this.editingLocked || this.inlineTitleNodeId || this.inlineContentNodeId) return true;
      const selectedNodeIds = this.selection
        .getSelectedCells()
        .filter((cell) => cell.isNode())
        .map((cell) => cell.id);
      if (selectedNodeIds.length === 0) return true;
      this.callbacks.onNodesDelete(selectedNodeIds);
      return false;
    });
  }

  setEditingLocked(locked: boolean): void {
    this.editingLocked = locked;
    if (locked) {
      this.selectedResizeNodeId = null;
      this.resizeFrame.hidden = true;
      this.cancelInlineTitleEdit();
      this.cancelInlineContentEdit();
    } else {
      this.scheduleResizeFrame();
    }
  }

  private isConnectionPortTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(".branchscript-connection-port") !== null;
  }

  private isNodeTitleTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('[data-selector="label"]') !== null;
  }

  private nodeContentField(target: EventTarget | null, node: GraphNode): "text" | "answer" | null {
    if (!(target instanceof Element)) return null;
    const selector = target.closest("[data-selector]")?.getAttribute("data-selector");
    if (selector === "text") return "text";
    if (selector === "answer") return "answer";
    if (selector === "detail") return node.answer ? "answer" : "text";
    return null;
  }

  private openInlineTitleEditor(node: Node): void {
    const sourceNode = this.document?.nodes.find((candidate) => candidate.id === node.id);
    if (!sourceNode) return;
    const element = this.container.querySelector<HTMLElement>(`.x6-node[data-cell-id="${CSS.escape(node.id)}"]`);
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const canvasBounds = this.container.getBoundingClientRect();
    const horizontalInset = Math.min(28, Math.max(12, bounds.width * 0.1));
    const verticalOffset = sourceNode.shape === "circle" ? bounds.height * 0.34 : Math.min(34, Math.max(14, bounds.height * 0.22));
    this.inlineTitleNodeId = node.id;
    this.inlineTitleEditor.value = sourceNode.label;
    this.inlineTitleEditor.style.left = `${bounds.left - canvasBounds.left + horizontalInset}px`;
    this.inlineTitleEditor.style.top = `${bounds.top - canvasBounds.top + verticalOffset}px`;
    this.inlineTitleEditor.style.width = `${Math.max(76, bounds.width - horizontalInset * 2)}px`;
    this.inlineTitleEditor.hidden = false;
    window.requestAnimationFrame(() => {
      this.inlineTitleEditor.focus();
      this.inlineTitleEditor.select();
    });
  }

  private commitInlineTitleEdit(): void {
    const nodeId = this.inlineTitleNodeId;
    if (!nodeId) return;
    const label = this.inlineTitleEditor.value.trim();
    this.inlineTitleNodeId = null;
    this.inlineTitleEditor.hidden = true;
    if (label) this.callbacks.onNodeTitleChange(nodeId, label);
  }

  private cancelInlineTitleEdit(): void {
    this.inlineTitleNodeId = null;
    this.inlineTitleEditor.hidden = true;
  }

  private openInlineContentEditor(node: Node, field: "text" | "answer"): void {
    const sourceNode = this.document?.nodes.find((candidate) => candidate.id === node.id);
    if (!sourceNode) return;
    const element = this.container.querySelector<HTMLElement>(`.x6-node[data-cell-id="${CSS.escape(node.id)}"]`);
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const canvasBounds = this.container.getBoundingClientRect();
    this.inlineContentNodeId = node.id;
    this.inlineContentField = field;
    this.inlineContentEditor.maxLength = field === "answer" ? 600 : 420;
    this.inlineContentEditor.value = sourceNode[field] ?? "";
    this.inlineContentEditor.style.left = `${bounds.left - canvasBounds.left + 12}px`;
    this.inlineContentEditor.style.top = `${bounds.top - canvasBounds.top + Math.min(64, Math.max(36, bounds.height * 0.35))}px`;
    this.inlineContentEditor.style.width = `${Math.max(90, bounds.width - 24)}px`;
    this.inlineContentEditor.style.height = `${Math.max(54, Math.min(160, bounds.height * 0.48))}px`;
    this.inlineContentEditor.hidden = false;
    window.requestAnimationFrame(() => {
      this.inlineContentEditor.focus();
      this.inlineContentEditor.select();
    });
  }

  private commitInlineContentEdit(): void {
    const nodeId = this.inlineContentNodeId;
    const field = this.inlineContentField;
    if (!nodeId || !field) return;
    const value = this.inlineContentEditor.value.trim();
    this.inlineContentNodeId = null;
    this.inlineContentField = null;
    this.inlineContentEditor.hidden = true;
    this.callbacks.onNodeContentChange(nodeId, field, value);
  }

  private cancelInlineContentEdit(): void {
    this.inlineContentNodeId = null;
    this.inlineContentField = null;
    this.inlineContentEditor.hidden = true;
  }

  private readonly onMinimapPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.minimapPointerId = event.pointerId;
    try {
      this.minimapContainer.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events do not create a native pointer capture session.
    }
    this.centerViewportAtMinimapPoint(event.clientX, event.clientY);
  };

  private readonly onMinimapPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.minimapPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.centerViewportAtMinimapPoint(event.clientX, event.clientY);
  };

  private readonly onMinimapPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.minimapPointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.minimapPointerId = null;
  };

  private readonly onMinimapMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // A mouse pointer also emits a compatibility mousedown. The pointer path
    // already navigated, but this event must still be consumed so the MiniMap
    // plugin cannot apply its older ratio-based scroll calculation afterwards.
    if (this.minimapPointerId !== null) return;
    this.minimapMouseDragging = true;
    this.centerViewportAtMinimapPoint(event.clientX, event.clientY);
    window.addEventListener("mousemove", this.onMinimapMouseMove, { capture: true, passive: false });
    window.addEventListener("mouseup", this.onMinimapMouseUp, { capture: true, passive: false });
  };

  private readonly onMinimapMouseMove = (event: MouseEvent): void => {
    if (!this.minimapMouseDragging) return;
    event.preventDefault();
    this.centerViewportAtMinimapPoint(event.clientX, event.clientY);
  };

  private readonly onMinimapMouseUp = (event: MouseEvent): void => {
    if (!this.minimapMouseDragging) return;
    event.preventDefault();
    this.minimapMouseDragging = false;
    window.removeEventListener("mousemove", this.onMinimapMouseMove, true);
    window.removeEventListener("mouseup", this.onMinimapMouseUp, true);
  };

  private centerViewportAtMinimapPoint(clientX: number, clientY: number): void {
    // MiniMap shares the source graph model, but its paper has an additional
    // fit transform. Invert that rendered matrix explicitly so zooming the main
    // canvas cannot make minimap navigation drift away from the pointer.
    const minimapGraph = (this.minimap as unknown as { targetGraph?: Graph }).targetGraph;
    if (!minimapGraph) return;
    const bounds = minimapGraph.container.getBoundingClientRect();
    const matrix = minimapGraph.matrix();
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < Number.EPSILON) return;

    const translatedX = clientX - bounds.left - matrix.e;
    const translatedY = clientY - bounds.top - matrix.f;
    const localX = (matrix.d * translatedX - matrix.c * translatedY) / determinant;
    const localY = (-matrix.b * translatedX + matrix.a * translatedY) / determinant;
    if (!Number.isFinite(localX) || !Number.isFinite(localY)) return;

    const content = this.graph.getContentArea();
    const targetX = content.width > 0 ? Math.max(content.x, Math.min(content.right, localX)) : localX;
    const targetY = content.height > 0 ? Math.max(content.y, Math.min(content.bottom, localY)) : localY;
    this.graph.centerPoint(targetX, targetY);
  }

  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    if (event.target instanceof Element && event.target.closest("[data-resize-handle]")) return;
    this.consumeTouchEvent(event);
    try {
      this.container.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events do not create a native pointer capture session.
    }

    this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.activeTouches.size === 1) {
      this.touchStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        nodeId: this.nodeIdFromTarget(event.target),
        moved: false,
      };
    } else {
      this.touchStart = null;
      this.lastTouchTap = null;
    }
  };

  private readonly onCanvasPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    const previous = this.activeTouches.get(event.pointerId);
    if (!previous) return;
    this.consumeTouchEvent(event);

    const next = { x: event.clientX, y: event.clientY };
    this.activeTouches.set(event.pointerId, next);
    if (this.touchStart && event.pointerId === this.touchStart.pointerId) {
      this.touchStart.moved ||= Math.hypot(next.x - this.touchStart.x, next.y - this.touchStart.y) > touchTapDistance;
    }

    if (this.activeTouches.size === 1) {
      this.queueTouchTransform(next.x - previous.x, next.y - previous.y);
      return;
    }

    this.touchStart = null;
    const pair = [...this.activeTouches.entries()].slice(0, 2);
    const movedIndex = pair.findIndex(([pointerId]) => pointerId === event.pointerId);
    if (movedIndex < 0) return;
    const currentA = pair[0]?.[1];
    const currentB = pair[1]?.[1];
    if (!currentA || !currentB) return;
    const previousA = movedIndex === 0 ? previous : currentA;
    const previousB = movedIndex === 1 ? previous : currentB;
    const previousDistance = Math.hypot(previousB.x - previousA.x, previousB.y - previousA.y);
    const currentDistance = Math.hypot(currentB.x - currentA.x, currentB.y - currentA.y);
    if (previousDistance < 1 || currentDistance < 1) return;

    const previousCenter = { x: (previousA.x + previousB.x) / 2, y: (previousA.y + previousB.y) / 2 };
    const currentCenter = { x: (currentA.x + currentB.x) / 2, y: (currentA.y + currentB.y) / 2 };
    const currentScale = this.pendingTouchTransform?.scale ?? this.graph.zoom();
    const targetScale = Math.max(minCanvasScale, Math.min(maxCanvasScale, currentScale * (currentDistance / previousDistance)));
    this.queueTouchTransform(
      currentCenter.x - previousCenter.x,
      currentCenter.y - previousCenter.y,
      targetScale,
      currentCenter,
    );
  };

  private readonly onCanvasPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    this.consumeTouchEvent(event);
    const start = this.touchStart;
    this.activeTouches.delete(event.pointerId);
    this.touchStart = null;
    if (!start || event.pointerId !== start.pointerId) return;
    if (start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > touchTapDistance) return;

    const timestamp = performance.now();
    const doubleTap =
      this.lastTouchTap?.nodeId === start.nodeId && timestamp - this.lastTouchTap.timestamp <= touchDoubleTapDelay;
    this.lastTouchTap = doubleTap ? null : { nodeId: start.nodeId, timestamp };

    if (start.nodeId) {
      this.focusNode(start.nodeId, false);
      if (doubleTap) {
        const node = this.graph.getCellById(start.nodeId);
        if (node instanceof Node) {
          this.callbacks.onNodeEdit(start.nodeId);
          window.setTimeout(() => this.zoomToNode(node), 80);
        }
      }
    } else {
      this.container.focus({ preventScroll: true });
      this.callbacks.onCanvasTap(this.clientPointToGraph(event.clientX, event.clientY));
      if (doubleTap) this.callbacks.onQuickAdd();
    }
  };

  private readonly onCanvasPointerCancel = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    this.consumeTouchEvent(event);
    this.activeTouches.delete(event.pointerId);
    this.touchStart = null;
    this.lastTouchTap = null;
  };

  private consumeTouchEvent(event: PointerEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private nodeIdFromTarget(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>(".x6-node[data-cell-id]")?.dataset.cellId ?? null;
  }

  private readonly onResizeHandlePointerDown = (event: PointerEvent): void => {
    if (this.editingLocked) return;
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const handle = event.currentTarget as HTMLButtonElement;
    const direction = handle.dataset.resizeHandle as ResizeDirection | undefined;
    const nodeId = this.selectedResizeNodeId;
    const cell = nodeId ? this.graph.getCellById(nodeId) : null;
    const sourceNode = this.document?.nodes.find((node) => node.id === nodeId);
    if (!direction || !nodeId || !(cell instanceof Node) || !sourceNode) return;

    event.preventDefault();
    event.stopPropagation();
    const size = cell.size();
    const position = cell.position();
    this.resizeSession = {
      pointerId: event.pointerId,
      nodeId,
      direction,
      clientX: event.clientX,
      clientY: event.clientY,
      position,
      size,
      nextPosition: position,
      nextSize: size,
      square: sourceNode.kind === "neuron" || sourceNode.shape === "circle",
    };
    this.resizeFrame.dataset.resizing = "true";
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", this.onResizePointerMove, { passive: false });
    window.addEventListener("pointerup", this.onResizePointerUp, { passive: false });
    window.addEventListener("pointercancel", this.onResizePointerCancel, { passive: false });
  };

  private readonly onResizePointerMove = (event: PointerEvent): void => {
    const session = this.resizeSession;
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    const scale = Math.max(this.graph.zoom(), minCanvasScale);
    const geometry = this.resizedGeometry(
      session,
      (event.clientX - session.clientX) / scale,
      (event.clientY - session.clientY) / scale,
    );
    session.nextPosition = geometry.position;
    session.nextSize = geometry.size;
    this.positionResizeFrame(geometry.position, geometry.size);
  };

  private readonly onResizePointerUp = (event: PointerEvent): void => {
    const session = this.resizeSession;
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    this.endResizeSession();
    const fontScale = (this.document?.fontScale ?? 100) / 100;
    this.callbacks.onNodeResize(
      session.nodeId,
      {
        width: Math.round(session.nextSize.width / fontScale),
        height: Math.round(session.nextSize.height / fontScale),
      },
      session.nextPosition,
    );
  };

  private readonly onResizePointerCancel = (event: PointerEvent): void => {
    if (!this.resizeSession || event.pointerId !== this.resizeSession.pointerId) return;
    this.endResizeSession();
    this.scheduleResizeFrame();
  };

  private endResizeSession(): void {
    this.resizeSession = null;
    delete this.resizeFrame.dataset.resizing;
    window.removeEventListener("pointermove", this.onResizePointerMove);
    window.removeEventListener("pointerup", this.onResizePointerUp);
    window.removeEventListener("pointercancel", this.onResizePointerCancel);
  }

  private resizedGeometry(session: ResizeSession, dx: number, dy: number): { position: Point; size: NodeSize } {
    const west = session.direction.includes("w");
    const east = session.direction.includes("e");
    const north = session.direction.includes("n");
    const south = session.direction.includes("s");
    let left = session.position.x + (west ? dx : 0);
    let right = session.position.x + session.size.width + (east ? dx : 0);
    let top = session.position.y + (north ? dy : 0);
    let bottom = session.position.y + session.size.height + (south ? dy : 0);

    let width = Math.min(maxBoxWidth, Math.max(minBoxWidth, right - left));
    let height = Math.min(maxBoxHeight, Math.max(minBoxHeight, bottom - top));

    if (session.square) {
      const diameter = Math.min(
        Math.min(maxBoxWidth, maxBoxHeight),
        Math.max(Math.max(minBoxWidth, minBoxHeight), east || west ? (north || south ? Math.max(width, height) : width) : height),
      );
      width = diameter;
      height = diameter;
      if (!west && !east) {
        left = session.position.x + (session.size.width - diameter) / 2;
        right = left + diameter;
      }
      if (!north && !south) {
        top = session.position.y + (session.size.height - diameter) / 2;
        bottom = top + diameter;
      }
    }

    if (west) left = right - width;
    else right = left + width;
    if (north) top = bottom - height;
    else bottom = top + height;

    return {
      position: { x: Math.round(left), y: Math.round(top) },
      size: { width: Math.round(right - left), height: Math.round(bottom - top) },
    };
  }

  private readonly scheduleResizeFrame = (): void => {
    if (this.resizeFrameId !== null || this.resizeSession) return;
    this.resizeFrameId = window.requestAnimationFrame(() => {
      this.resizeFrameId = null;
      this.updateResizeFrame();
    });
  };

  private updateResizeFrame(): void {
    const nodeId = this.selectedResizeNodeId;
    const cell = nodeId ? this.graph.getCellById(nodeId) : null;
    if (!(cell instanceof Node)) {
      this.resizeFrame.hidden = true;
      return;
    }
    this.resizeFrame.hidden = false;
    this.positionResizeFrame(cell.position(), cell.size());
  }

  private positionResizeFrame(position: Point, size: NodeSize): void {
    const bounds = this.graph.localToClient({ x: position.x, y: position.y, width: size.width, height: size.height });
    const containerBounds = this.container.getBoundingClientRect();
    this.resizeFrame.style.left = `${bounds.x - containerBounds.left}px`;
    this.resizeFrame.style.top = `${bounds.y - containerBounds.top}px`;
    this.resizeFrame.style.width = `${bounds.width}px`;
    this.resizeFrame.style.height = `${bounds.height}px`;
  }

  private readonly scheduleViewportOverlays = (): void => {
    this.scheduleEdgeVisibility();
    this.scheduleResizeFrame();
  };

  private queueTouchTransform(dx: number, dy: number, scale: number | null = null, center: Point | null = null): void {
    const pending = this.pendingTouchTransform ?? { dx: 0, dy: 0, scale: null, center: null };
    pending.dx += dx;
    pending.dy += dy;
    if (scale !== null && center) {
      pending.scale = scale;
      pending.center = center;
    }
    this.pendingTouchTransform = pending;
    if (this.touchFrame === null) this.touchFrame = window.requestAnimationFrame(this.applyPendingTouchTransform);
  }

  private readonly applyPendingTouchTransform = (): void => {
    this.touchFrame = null;
    const pending = this.pendingTouchTransform;
    this.pendingTouchTransform = null;
    if (!pending) return;
    if (pending.dx !== 0 || pending.dy !== 0) this.graph.translateBy(pending.dx, pending.dy);
    if (pending.scale !== null && pending.center) {
      const anchor = this.graph.clientToGraph(pending.center);
      this.graph.zoom(pending.scale, { absolute: true, center: anchor });
    }
  };

  render(
    document: GraphDocument,
    direction: LayoutDirection,
    savedPositions: Record<string, Point>,
    forceLayout = false,
  ): Record<string, Point> {
    if (this.resizeSession) this.endResizeSession();
    this.cancelInlineTitleEdit();
    this.cancelInlineContentEdit();
    this.selectedResizeNodeId = null;
    this.resizeFrame.hidden = true;
    this.document = document;
    this.container.dataset.nodeCount = String(document.nodes.length);
    const automaticPositions = calculateLayout(document, direction);
    const positions = forceLayout
      ? automaticPositions
      : Object.fromEntries(
          document.nodes.map((node) => [
            node.id,
            savedPositions[node.id] ?? automaticPositions[node.id] ?? { x: 0, y: 0 },
          ]),
        );

    this.history.disable();
    this.graph.clearCells();
    if (document.nodes.length > virtualNodeThreshold) this.graph.enableVirtualRender();
    else this.graph.disableVirtualRender();

    for (const node of document.nodes) {
      const position = positions[node.id] ?? { x: 0, y: 0 };
      this.graph.addNode(this.nodeMetadata(node, position));
    }

    const nodeIds = new Set(document.nodes.map((node) => node.id));

    for (const edge of document.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
      const smooth = document.view === "tree" || document.view === "neural";
      this.graph.addEdge({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: { initial: true },
        zIndex: 0,
        ...(smooth ? {} : { router: { name: "orth", args: { padding: 24 } } }),
        connector: smooth
          ? { name: "smooth" }
          : { name: "rounded", args: { radius: 12 } },
        ...(edge.label
          ? {
              labels: [
                {
                  position: 0.55,
                  attrs: {
                    body: {
                      fill: "#162019",
                      stroke: edgeColor(edge, document.view),
                      strokeWidth: 1,
                      rx: 8,
                      ry: 8,
                    },
                    label: {
                      text: edge.label,
                      fill: "#eaf3ec",
                      fontSize: 10,
                      fontWeight: 700,
                    },
                  },
                },
              ],
            }
          : {}),
        attrs: {
          line: {
            class: "branchscript-edge-line",
            stroke: edgeColor(edge, document.view),
            strokeWidth: document.view === "neural" ? 1.4 : edge.kind === "reference" ? 1.5 : 2,
            opacity: document.view === "neural" ? 0.82 : 1,
            strokeDasharray: edge.kind === "reference" ? "6 5" : "",
            targetMarker: { name: "block", width: 8, height: 7 },
          },
        },
      });
    }

    this.scheduleViewportOverlays();

    this.history.clean();
    this.history.enable();
    return positions;
  }

  refreshTheme(): void {
    if (!this.document) return;
    for (const sourceNode of this.document.nodes) {
      const cell = this.graph.getCellById(sourceNode.id);
      if (!(cell instanceof Node)) continue;
      const attrs = this.nodeMetadata(sourceNode, cell.position()).attrs;
      if (attrs) cell.setAttrs(attrs);
    }
  }

  private nodeMetadata(node: GraphNode, position: Point): Node.Metadata {
    let metadata: Node.Metadata;
    if (node.kind === "text") metadata = this.textMetadata(node, position);
    else if (dataKinds.has(node.kind) && !node.shape) metadata = this.dataMetadata(node, position);
    else {
      const shape = node.shape ?? (node.kind === "decision" || node.kind === "condition" ? "diamond" : node.kind === "neuron" ? "circle" : node.kind === "input" || node.kind === "output" || node.kind === "start" || node.kind === "return" ? "pill" : "card");
      if (shape === "diamond") metadata = this.decisionMetadata(node, position);
      else if (shape === "circle") metadata = this.neuronMetadata(node, position);
      else metadata = this.cardMetadata(node, position, shape);
    }
    const scaled = this.scaleNodeMetadata(metadata);
    scaled.ports = this.connectionPorts(node);
    return scaled;
  }

  private connectionPorts(node: GraphNode) {
    const colors = paletteForNode(node);
    const port = {
      r: 5,
      magnet: true,
      stroke: colors.stroke,
      strokeWidth: 2,
      fill: nodeFill(colors),
      class: "branchscript-connection-port",
    };
    return {
      groups: {
        top: { position: "top", attrs: { circle: port } },
        right: { position: "right", attrs: { circle: port } },
        bottom: { position: "bottom", attrs: { circle: port } },
        left: { position: "left", attrs: { circle: port } },
      },
      items: [
        { id: "top", group: "top" },
        { id: "right", group: "right" },
        { id: "bottom", group: "bottom" },
        { id: "left", group: "left" },
      ],
    };
  }

  private scaleNodeMetadata(metadata: Node.Metadata): Node.Metadata {
    const scale = (this.document?.fontScale ?? 100) / 100;
    if (scale === 1) return metadata;
    if (typeof metadata.width === "number") metadata.width = Math.round(metadata.width * scale);
    if (typeof metadata.height === "number") metadata.height = Math.round(metadata.height * scale);
    const attrs = metadata.attrs as Record<string, Record<string, unknown>> | undefined;
    for (const attributes of Object.values(attrs ?? {})) {
      if (!attributes || typeof attributes !== "object") continue;
      for (const property of ["x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "fontSize", "letterSpacing"]) {
        const value = attributes[property];
        if (typeof value === "number") attributes[property] = value * scale;
      }
      if (typeof attributes.points === "string") {
        attributes.points = attributes.points.replace(/-?\d+(?:\.\d+)?/g, (value) => String(Number(value) * scale));
      }
      const textWrap = attributes.textWrap as Record<string, unknown> | undefined;
      if (textWrap) {
        if (typeof textWrap.width === "number") textWrap.width *= scale;
        if (typeof textWrap.height === "number") textWrap.height *= scale;
      }
    }
    return metadata;
  }

  private cardMetadata(node: GraphNode, position: Point, shape: "card" | "pill"): Node.Metadata {
    const colors = paletteForNode(node);
    const size = sizeForNode(node);
    const labelPosition = textPositionForNode(node, size.width, 20);
    const categoryWidth = categoryBadgeWidth(node, Math.max(58, size.width * 0.46));
    const pill = shape === "pill";
    const rich = Boolean(node.text || node.answer || node.feature);
    const markup: Node.Metadata["markup"] = [
      { tagName: "rect", selector: "body" },
      { tagName: "rect", selector: "accent" },
      { tagName: "text", selector: "kind" },
      { tagName: "text", selector: "label" },
    ];
    if (node.category) markup.push({ tagName: "rect", selector: "categoryBody" }, { tagName: "text", selector: "category" });
    const attrs: NonNullable<Node.Metadata["attrs"]> = {
      body: {
        class: "branchscript-node-body",
        width: size.width,
        height: size.height,
          rx: pill && !rich ? size.height / 2 : 15,
          ry: pill && !rich ? size.height / 2 : 15,
        fill: nodeFill(colors),
        stroke: colors.stroke,
        strokeWidth: node.priority === "high" ? 2.5 : 1.5,
      },
      accent: {
        x: 0,
        y: 0,
        width: 6,
        height: size.height,
        rx: 3,
        fill: colors.stroke,
        stroke: "none",
      },
      kind: {
        text: this.nodeCaption(node, false),
        x: 20,
        y: 24,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.1,
        textAnchor: "start",
        textWrap: { width: Math.max(48, size.width - categoryWidth - 54), height: 12, ellipsis: true },
      },
      label: {
        text: node.label,
        x: labelPosition.x,
        y: 44,
        refX: 0,
        refY: 0,
        fill: "#f5f8f5",
        fontFamily: fontFamilyForNode(node),
        fontSize: node.fontSize ?? 14,
        fontWeight: fontWeightForNode(node, 650),
        textAnchor: labelPosition.anchor,
        textVerticalAnchor: "top",
        textWrap: {
          width: size.width - 40,
          height: rich ? 40 : size.height - 56,
          ellipsis: true,
        },
      },
    };
    if (node.category) {
      attrs.categoryBody = {
        x: size.width - categoryWidth - 14,
        y: 11,
        width: categoryWidth,
        height: 19,
        rx: 9.5,
        ry: 9.5,
        fill: colors.stroke,
        opacity: 0.18,
        stroke: colors.stroke,
        strokeWidth: 1,
      };
      attrs.category = {
        text: node.category.toLocaleUpperCase(),
        x: size.width - categoryWidth / 2 - 14,
        y: 24,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: 0.55,
        textAnchor: "middle",
        textWrap: { width: categoryWidth - 14, height: 11, ellipsis: true },
      };
    }
    let cursor = 90;
    const addContent = (selector: "text" | "answer", value: string, height: number) => {
      markup.push(
        { tagName: "text", selector: `${selector}Caption` },
        { tagName: "text", selector },
      );
      attrs[`${selector}Caption`] = {
        text: this.contentCaption(selector),
        x: 20,
        y: cursor,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        opacity: 0.8,
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: 1,
        textAnchor: "start",
      };
      attrs[selector] = {
        text: value,
        x: 20,
        y: cursor + 15,
        refX: 0,
        refY: 0,
        fill: selector === "answer" ? "#e7f5ef" : "#c7cfca",
        fontSize: selector === "answer" ? 11 : 10,
        fontWeight: selector === "answer" ? 600 : 450,
        textAnchor: "start",
        textVerticalAnchor: "top",
        textWrap: { width: size.width - 40, height: height - 16, ellipsis: true },
      };
      cursor += height;
    };
    if (node.text) addContent("text", node.text, 50);
    if (node.answer) addContent("answer", node.answer, 64);
    if (node.feature) {
      markup.push({ tagName: "rect", selector: "featureBody" }, { tagName: "text", selector: "feature" });
      attrs.featureBody = {
        x: 16,
        y: size.height - 31,
        width: size.width - 32,
        height: 20,
        rx: 6,
        ry: 6,
        fill: colors.stroke,
        opacity: 0.16,
        stroke: colors.stroke,
        strokeWidth: 1,
      };
      attrs.feature = {
        class: "branchscript-node-feature",
        text: `${this.featureCaption()} · ${node.feature}`,
        x: 25,
        y: size.height - 17,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize: 8,
        fontWeight: 750,
        letterSpacing: 0.45,
        textAnchor: "start",
        textWrap: { width: size.width - 50, height: 14, ellipsis: true },
      };
    }
    return {
      id: node.id,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      zIndex: 2,
      data: { kind: node.kind, label: node.label },
      markup,
      attrs,
    };
  }

  private textMetadata(node: GraphNode, position: Point): Node.Metadata {
    const colors = paletteForNode(node);
    const size = sizeForNode(node);
    const fontSize = node.fontSize ?? 18;
    const labelPosition = textPositionForNode(node, size.width, 14);
    const light = document.documentElement.dataset.theme === "light";
    const labelY = node.category ? 38 : 12;
    const categoryWidth = categoryBadgeWidth(node, size.width - 28);
    const markup: Node.Metadata["markup"] = [
      { tagName: "rect", selector: "body" },
      { tagName: "text", selector: "label" },
    ];
    if (node.category) markup.push({ tagName: "rect", selector: "categoryBody" }, { tagName: "text", selector: "category" });
    const attrs: NonNullable<Node.Metadata["attrs"]> = {
      body: {
        class: "branchscript-node-body branchscript-text-block",
        width: size.width,
        height: size.height,
        rx: 8,
        ry: 8,
        fill: light ? compositeColor(colors.stroke, lightCanvasColor, 0.045) : translucentColor(colors.stroke, 0.06),
        stroke: translucentColor(colors.stroke, 0.22),
        strokeWidth: 1,
        strokeDasharray: "4 5",
      },
      label: {
        text: node.label,
        x: labelPosition.x,
        y: labelY,
        refX: 0,
        refY: 0,
        fill: light ? "#25322d" : "#f0f5f2",
        fontFamily: fontFamilyForNode(node),
        fontSize,
        fontWeight: fontWeightForNode(node, 650),
        textAnchor: labelPosition.anchor,
        textVerticalAnchor: "top",
        textWrap: { width: size.width - 28, height: node.text ? Math.max(24, size.height * 0.55) : size.height - 24, ellipsis: true },
      },
    };
    if (node.category) {
      attrs.categoryBody = {
        x: 14, y: 10, width: categoryWidth, height: 19, rx: 9.5, ry: 9.5,
        fill: colors.stroke, opacity: 0.16, stroke: colors.stroke, strokeWidth: 1,
      };
      attrs.category = {
        text: node.category.toLocaleUpperCase(),
        x: 14 + categoryWidth / 2,
        y: 23,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: 0.55,
        textAnchor: "middle",
        textWrap: { width: categoryWidth - 14, height: 11, ellipsis: true },
      };
    }
    if (node.text) {
      markup.push({ tagName: "text", selector: "text" });
      attrs.text = {
        text: node.text,
        x: labelPosition.x,
        y: Math.min(size.height - 20, labelY + 8 + fontSize * 1.45),
        refX: 0,
        refY: 0,
        fill: light ? "#4e5d56" : "#bbc7c0",
        fontFamily: fontFamilyForNode(node),
        fontSize: Math.max(10, Math.round(fontSize * 0.72)),
        fontWeight: node.fontWeight === "bold" ? 650 : 450,
        textAnchor: labelPosition.anchor,
        textVerticalAnchor: "top",
        textWrap: { width: size.width - 28, height: Math.max(18, size.height - (labelY + 20 + fontSize * 1.45)), ellipsis: true },
      };
    }
    return {
      id: node.id,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      zIndex: 2,
      data: { kind: node.kind, label: node.label },
      markup,
      attrs,
    };
  }

  private decisionMetadata(node: GraphNode, position: Point): Node.Metadata {
    const colors = paletteForNode(node);
    const size = sizeForNode(node);
    const detail = node.answer ?? node.text;
    const markup: Node.Metadata["markup"] = [
      { tagName: "polygon", selector: "body" },
      { tagName: "text", selector: "kind" },
      { tagName: "text", selector: "label" },
    ];
    if (detail) markup.push({ tagName: "text", selector: "detail" });
    if (node.feature) markup.push({ tagName: "text", selector: "feature" });
    return {
      id: node.id,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      zIndex: 2,
      data: { kind: node.kind, label: node.label },
      markup,
      attrs: {
        body: {
          class: "branchscript-node-body",
          points: `${size.width / 2},2 ${size.width - 2},${size.height / 2} ${size.width / 2},${size.height - 2} 2,${size.height / 2}`,
          fill: nodeFill(colors),
          stroke: colors.stroke,
          strokeWidth: node.priority === "high" ? 2.5 : 1.6,
          strokeLinejoin: "round",
        },
        kind: {
          text: this.nodeCaption(node),
          x: size.width / 2,
          y: detail ? 39 : 43,
          refX: 0,
          refY: 0,
          fill: colors.accent,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.1,
          textAnchor: "middle",
        },
        label: {
          text: node.label,
          x: size.width / 2,
          y: detail ? size.height / 2 - 12 : size.height / 2 + 7,
          refX: 0,
          refY: 0,
          fill: "#f7f2e8",
          fontSize: 13,
          fontWeight: 650,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          textWrap: { width: size.width - 74, height: detail ? 38 : 54, ellipsis: true },
        },
        detail: {
          text: detail,
          x: size.width / 2,
          y: size.height / 2 + 24,
          refX: 0,
          refY: 0,
          fill: node.answer ? "#fff3d6" : "#d1c8b5",
          fontSize: 9,
          fontWeight: node.answer ? 620 : 450,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          textWrap: { width: size.width - 106, height: 38, ellipsis: true },
        },
        feature: {
          class: "branchscript-node-feature",
          text: node.feature ? `${this.featureCaption()} · ${node.feature}` : "",
          x: size.width / 2,
          y: size.height - 29,
          refX: 0,
          refY: 0,
          fill: colors.accent,
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: 0.4,
          textAnchor: "middle",
          textWrap: { width: size.width - 118, height: 12, ellipsis: true },
        },
      },
    };
  }

  private neuronMetadata(node: GraphNode, position: Point): Node.Metadata {
    const colors = paletteForNode(node);
    const size = sizeForNode(node);
    const detail = node.answer ?? node.text;
    const markup: Node.Metadata["markup"] = [
      { tagName: "circle", selector: "body" },
      { tagName: "circle", selector: "halo" },
      { tagName: "text", selector: "kind" },
      { tagName: "text", selector: "label" },
    ];
    if (detail) markup.push({ tagName: "text", selector: "detail" });
    if (node.feature) markup.push({ tagName: "text", selector: "feature" });
    return {
      id: node.id,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      zIndex: 2,
      data: { kind: node.kind, label: node.label },
      markup,
      attrs: {
        halo: {
          cx: size.width / 2,
          cy: size.height / 2,
          r: size.width / 2 - 2,
          fill: "none",
          stroke: colors.stroke,
          strokeWidth: 1,
          strokeOpacity: 0.28,
        },
        body: {
          class: "branchscript-node-body",
          cx: size.width / 2,
          cy: size.height / 2,
          r: size.width / 2 - 9,
          fill: nodeFill(colors),
          stroke: colors.stroke,
          strokeWidth: 2,
        },
        kind: {
          text: this.nodeCaption(node),
          x: size.width / 2,
          y: Math.max(32, size.height * 0.23),
          refX: 0,
          refY: 0,
          fill: colors.accent,
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: 1,
          textAnchor: "middle",
        },
        label: {
          text: node.label,
          x: size.width / 2,
          y: detail ? size.height * 0.46 : size.height * 0.52,
          refX: 0,
          refY: 0,
          fill: "#f2f6ff",
          fontSize: 11,
          fontWeight: 650,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          textWrap: { width: Math.max(48, size.width * 0.68), height: detail ? Math.max(30, size.height * 0.18) : Math.max(42, size.height * 0.28), ellipsis: true },
        },
        detail: {
          text: detail,
          x: size.width / 2,
          y: size.height * 0.65,
          refX: 0,
          refY: 0,
          fill: "#c7d7e9",
          fontSize: 8,
          fontWeight: node.answer ? 620 : 450,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
          textWrap: { width: Math.max(42, size.width * 0.6), height: Math.max(34, size.height * 0.2), ellipsis: true },
        },
        feature: {
          class: "branchscript-node-feature",
          text: node.feature ?? "",
          x: size.width / 2,
          y: size.height * 0.82,
          refX: 0,
          refY: 0,
          fill: colors.accent,
          fontSize: 7,
          fontWeight: 800,
          textAnchor: "middle",
          textWrap: { width: Math.max(38, size.width * 0.54), height: 11, ellipsis: true },
        },
      },
    };
  }

  private dataMetadata(node: GraphNode, position: Point): Node.Metadata {
    const colors = paletteForNode(node);
    const size = sizeForNode(node);
    const categoryWidth = categoryBadgeWidth(node, Math.max(58, size.width * 0.46));
    const isContainer = ["array", "stack", "queue", "list"].includes(node.kind);
    const isRecord = node.kind === "record";
    const cells = isContainer ? dataItems(node) : [];
    const fields = isRecord ? dataFields(node) : [];
    const detail = node.answer ?? node.text;
    const markup: Node.Metadata["markup"] = [
      { tagName: "rect", selector: "body" },
      { tagName: "text", selector: "kind" },
      { tagName: "text", selector: "label" },
    ];
    if (node.category) markup.push({ tagName: "rect", selector: "categoryBody" }, { tagName: "text", selector: "category" });
    const values = [...cells, ...fields];
    values.forEach((_, index) => {
      markup.push(
        { tagName: "rect", selector: `dataCell${index}` },
        { tagName: "text", selector: `dataCellLabel${index}` },
      );
    });
    if (detail) markup.push({ tagName: "text", selector: "detail" });
    if (node.feature) markup.push({ tagName: "text", selector: "feature" });
    const vertical = node.kind === "stack";
    const attrs: NonNullable<Node.Metadata["attrs"]> = {
      body: {
        class: "branchscript-node-body",
        width: size.width,
        height: size.height,
        rx: node.kind === "pointer" ? size.height / 2 : 12,
        ry: node.kind === "pointer" ? size.height / 2 : 12,
        fill: nodeFill(colors),
        stroke: colors.stroke,
        strokeWidth: node.priority === "high" ? 2.5 : 1.5,
      },
      kind: {
        text: this.nodeCaption(node, false), x: 14, y: 22, fill: colors.accent,
        refX: 0, refY: 0,
        fontSize: 9, fontWeight: 800, letterSpacing: 1, textAnchor: "start",
        textWrap: { width: Math.max(42, size.width - categoryWidth - 42), height: 11, ellipsis: true },
      },
      label: {
        text: node.label, x: 14, y: 43,
        refX: 0, refY: 0,
        fill: "#f2f6f3", fontSize: 12, fontWeight: 620, textAnchor: "start",
        textWrap: { width: size.width - 28, height: 20, ellipsis: true },
      },
    };
    if (node.category) {
      attrs.categoryBody = {
        x: size.width - categoryWidth - 12, y: 9, width: categoryWidth, height: 18, rx: 9, ry: 9,
        fill: colors.stroke, opacity: 0.18, stroke: colors.stroke, strokeWidth: 1,
      };
      attrs.category = {
        text: node.category.toLocaleUpperCase(),
        x: size.width - categoryWidth / 2 - 12,
        y: 21.5,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize: 7.5,
        fontWeight: 800,
        letterSpacing: 0.5,
        textAnchor: "middle",
        textWrap: { width: categoryWidth - 12, height: 10, ellipsis: true },
      };
    }

    values.forEach((value, index) => {
      const horizontal = !vertical && isContainer;
      const count = Math.max(values.length, 1);
      const cellWidth = (size.width - 24) / count;
      const x = horizontal ? 12 + index * cellWidth : 12;
      const y = horizontal ? 57 : isRecord ? 57 + index * 22 : 53 + index * 22;
      const width = horizontal ? cellWidth : size.width - 24;
      const height = horizontal ? 34 : 22;
      attrs[`dataCell${index}`] = {
        x, y, width, height,
        fill: colors.stroke,
        fillOpacity: 0.13,
        stroke: colors.stroke,
        strokeWidth: 1,
        strokeOpacity: 0.48,
        rx: 4,
        ry: 4,
      };
      const fontSize = horizontal ? 10 : 9;
      attrs[`dataCellLabel${index}`] = {
        text: fitDataCellText(value, width, fontSize),
        x: horizontal ? x + width / 2 : x + 9,
        y: horizontal ? y + 21 : y + 15,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize,
        fontWeight: 700,
        textAnchor: horizontal ? "middle" : "start",
      };
    });

    const detailY = isRecord
      ? 65 + fields.length * 22
      : vertical
        ? 61 + cells.length * 22
        : isContainer
          ? 105
          : 62;
    if (detail) {
      const detailBottom = node.feature ? size.height - 34 : size.height - 14;
      attrs.detail = {
        text: detail,
        x: 14,
        y: detailY,
        refX: 0,
        refY: 0,
        fill: "#c7d2cc",
        fontSize: 9,
        fontWeight: node.answer ? 620 : 450,
        textAnchor: "start",
        textVerticalAnchor: "top",
        textWrap: { width: size.width - 28, height: Math.max(18, detailBottom - detailY), ellipsis: true },
      };
    }
    if (node.feature) {
      attrs.feature = {
        class: "branchscript-node-feature",
        text: `${this.featureCaption()} · ${node.feature}`,
        x: 14,
        y: size.height - 14,
        refX: 0,
        refY: 0,
        fill: colors.accent,
        fontSize: 7,
        fontWeight: 800,
        textAnchor: "start",
        textWrap: { width: size.width - 28, height: 11, ellipsis: true },
      };
    }

    return {
      id: node.id,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      zIndex: 2,
      data: { kind: node.kind, label: node.label },
      markup,
      attrs,
    };
  }

  private nodeCaption(node: GraphNode, includeCategory = true): string {
    const parts = [node.kind, node.status, includeCategory ? node.category : undefined].filter(Boolean);
    return parts.join(" · ").toLocaleUpperCase();
  }

  private contentCaption(selector: "text" | "answer"): string {
    if (selector === "answer") return t("Prepared answer").toLocaleUpperCase();
    const label = {
      tree: "Context",
      flow: "Step detail",
      neural: "Signal",
      logic: "Rule",
      algorithm: "Pseudocode",
      data: "Value",
    }[this.document?.view ?? "tree"];
    return t(label).toLocaleUpperCase();
  }

  private featureCaption(): string {
    const label = {
      tree: "Follow-up cue",
      flow: "Expected result",
      neural: "Activation",
      logic: "Branch rule",
      algorithm: "Complexity",
      data: "Operation",
    }[this.document?.view ?? "tree"];
    return t(label).toLocaleUpperCase();
  }

  focusNode(nodeId: string, center = true): void {
    const cell = this.graph.getCellById(nodeId);
    if (!(cell instanceof Node)) return;
    this.selection.clean();
    this.selection.select(cell);
    if (center) this.graph.centerCell(cell);
  }

  private zoomToNode(node: Node): void {
    this.pendingZoom = null;
    if (this.zoomFrame !== null) {
      window.cancelAnimationFrame(this.zoomFrame);
      this.zoomFrame = null;
    }

    const overlay = this.container.parentElement?.querySelector<HTMLElement>(".quick-builder:not([hidden])");
    const canvasBounds = this.container.getBoundingClientRect();
    const overlayBounds = overlay?.getBoundingClientRect();
    const coveredWidth = overlayBounds
      ? Math.max(0, canvasBounds.right - Math.max(canvasBounds.left, overlayBounds.left))
      : 0;
    // A node double-click is an inspection action: focus the chosen box at a
    // predictable, readable scale instead of fitting its whole neighborhood.
    // The latter can leave a dense algorithm or logic diagram far too small.
    const targetScale = 1.2;
    this.graph.zoom(targetScale, {
      absolute: true,
      center: node.getBBox().getCenter(),
    });
    this.graph.centerCell(node);

    if (coveredWidth > 0) {
      this.graph.translateBy(-coveredWidth / 2, 0);
    }
    this.scheduleEdgeVisibility();
  }

  searchMatches(query: string): string[] {
    return this.document ? matchingNodeIds(this.document, query) : [];
  }

  focusSearchResult(nodeId: string): void {
    const cell = this.graph.getCellById(nodeId);
    if (!(cell instanceof Node)) return;
    this.focusNode(nodeId, false);
    this.zoomToNode(cell);
  }

  applySearch(query: string, activeId: string | null = null): void {
    if (!this.document) return;
    const searching = query.trim().length > 0;
    for (const node of this.document.nodes) {
      const cell = this.graph.getCellById(node.id);
      if (!(cell instanceof Node)) continue;
      const matches = !searching || nodeMatchesSearch(node, query);
      const active = node.id === activeId;
      cell.attr("body/opacity", 1);
      cell.attr("body/strokeOpacity", matches ? 1 : 0.28);
      cell.attr("accent/opacity", matches ? 1 : 0.24);
      cell.attr("kind/opacity", matches ? 1 : 0.3);
      cell.attr("label/opacity", matches ? 1 : 0.3);
      for (const selector of ["text", "textCaption", "answer", "answerCaption", "feature", "featureBody", "detail", "halo", "category", "categoryBody"]) {
        cell.attr(`${selector}/opacity`, matches ? 1 : 0.22);
      }
      cell.attr("body/strokeWidth", active ? 4 : node.priority === "high" ? 2.5 : node.kind === "text" ? 1 : 1.5);
      cell.attr("body/class", active ? "branchscript-node-body search-active-node" : node.kind === "text" ? "branchscript-node-body branchscript-text-block" : "branchscript-node-body");
    }
  }

  highlightPath(path: string[]): void {
    if (!this.document) return;
    const pathSet = new Set(path);
    const activeId = path.at(-1);
    const pairs = new Set(path.slice(1).map((target, index) => `${path[index]}:${target}`));
    const hasPath = path.length > 0;

    for (const node of this.document.nodes) {
      const cell = this.graph.getCellById(node.id);
      if (!(cell instanceof Node)) continue;
      const visible = !hasPath || pathSet.has(node.id);
      const active = node.id === activeId;
      for (const selector of ["body", "accent", "halo", "kind", "label"]) {
        cell.attr(`${selector}/opacity`, visible ? 1 : 0.14);
      }
      cell.attr("body/strokeWidth", active ? 4 : pathSet.has(node.id) ? 2.5 : 1.4);
      cell.attr("body/class", active ? "branchscript-node-body live-active-node" : "branchscript-node-body");
    }

    for (const edge of this.document.edges) {
      const cell = this.graph.getCellById(edge.id);
      if (!cell?.isEdge()) continue;
      const active = pairs.has(`${edge.source}:${edge.target}`);
      cell.attr("line/opacity", !hasPath ? (this.document.view === "neural" ? 0.82 : 1) : active ? 1 : 0.1);
      cell.attr("line/strokeWidth", active ? 3.4 : this.document.view === "neural" ? 1.4 : 2);
      cell.attr("line/class", active ? "branchscript-edge-line live-active-edge" : "branchscript-edge-line");
    }
  }

  clearHighlight(): void {
    this.highlightPath([]);
  }

  private readonly scheduleEdgeVisibility = (): void => {
    if (this.edgeVisibilityFrame !== null) return;
    this.edgeVisibilityFrame = window.requestAnimationFrame(() => {
      this.edgeVisibilityFrame = null;
      this.updateEdgeVisibility();
    });
  };

  private readonly updateEdgeVisibility = (): void => {
    if (!this.document) return;

    const viewport = this.graph.getGraphArea();
    const shouldCull = this.document.nodes.length > virtualNodeThreshold;
    const scale = Math.max(this.graph.zoom(), minCanvasScale);
    const overscan = Math.min(1800, Math.max(180, 260 / scale));
    for (const edge of this.document.edges) {
      const cell = this.graph.getCellById(edge.id);
      const source = this.graph.getCellById(edge.source);
      const target = this.graph.getCellById(edge.target);
      if (!cell?.isEdge() || !(source instanceof Node) || !(target instanceof Node)) continue;

      const visible = !shouldCull ||
        intersectsWithOverscan(viewport, cell.getBBox(), overscan) ||
        intersectsWithOverscan(viewport, source.getBBox(), overscan) ||
        intersectsWithOverscan(viewport, target.getBBox(), overscan);
      if (cell.isVisible() !== visible) cell.setVisible(visible);
    }
  };

  setLiveView(view: DiagramView | null): void {
    if (view) this.container.dataset.liveView = view;
    else delete this.container.dataset.liveView;
  }

  fit(): void {
    this.graph.zoomToFit({ padding: 48, minScale: 0.01, maxScale: 1.05 });
    this.graph.centerContent();
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  getPositions(): Record<string, Point> {
    return Object.fromEntries(
      this.graph.getNodes().map((node) => {
        const position = node.position();
        return [node.id, { x: position.x, y: position.y }];
      }),
    );
  }

  clientPointToGraph(clientX: number, clientY: number): Point {
    const point = this.graph.clientToGraph({ x: clientX, y: clientY });
    return { x: point.x, y: point.y };
  }

  private emitPositions(): void {
    this.callbacks.onPositionsChange(this.getPositions());
  }

  private readonly onCanvasWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();

      const currentScale = this.pendingZoom?.scale ?? this.graph.zoom();
      const targetScale = nextWheelZoomScale(currentScale, event.deltaY);
      if (targetScale === currentScale) return;

      this.pendingZoom = {
        scale: targetScale,
        center: this.graph.clientToGraph({ x: event.clientX, y: event.clientY }),
      };
      if (this.zoomFrame === null) this.zoomFrame = window.requestAnimationFrame(this.applyPendingZoom);
      return;
    }

    event.preventDefault();
    this.graph.translateBy(-event.deltaX, -event.deltaY);
  };

  dispose(): void {
    this.container.removeEventListener("wheel", this.onCanvasWheel);
    this.container.removeEventListener("pointerdown", this.onCanvasPointerDown, true);
    this.container.removeEventListener("pointermove", this.onCanvasPointerMove, true);
    this.container.removeEventListener("pointerup", this.onCanvasPointerUp, true);
    this.container.removeEventListener("pointercancel", this.onCanvasPointerCancel, true);
    this.minimapContainer.removeEventListener("pointerdown", this.onMinimapPointerDown, true);
    this.minimapContainer.removeEventListener("pointermove", this.onMinimapPointerMove, true);
    this.minimapContainer.removeEventListener("pointerup", this.onMinimapPointerUp, true);
    this.minimapContainer.removeEventListener("pointercancel", this.onMinimapPointerUp, true);
    this.minimapContainer.removeEventListener("mousedown", this.onMinimapMouseDown, true);
    this.minimapMouseDragging = false;
    window.removeEventListener("mousemove", this.onMinimapMouseMove, true);
    window.removeEventListener("mouseup", this.onMinimapMouseUp, true);
    window.removeEventListener("resize", this.scheduleResizeFrame);
    this.endResizeSession();
    if (this.edgeVisibilityFrame !== null) window.cancelAnimationFrame(this.edgeVisibilityFrame);
    if (this.resizeFrameId !== null) window.cancelAnimationFrame(this.resizeFrameId);
    if (this.zoomFrame !== null) window.cancelAnimationFrame(this.zoomFrame);
    if (this.touchFrame !== null) window.cancelAnimationFrame(this.touchFrame);
    this.graph.dispose();
  }

  private readonly applyPendingZoom = (): void => {
    this.zoomFrame = null;
    const pendingZoom = this.pendingZoom;
    this.pendingZoom = null;
    if (!pendingZoom) return;
    this.graph.zoom(pendingZoom.scale, { absolute: true, center: pendingZoom.center });
  };
}
