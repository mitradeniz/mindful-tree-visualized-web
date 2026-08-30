import { graphlib, layout } from "@dagrejs/dagre";
import type { LayoutDirection, Point } from "../app/app-store";
import type { GraphDocument, GraphNode } from "../domain/graph-document";
import { dataFields, dataItems } from "./data-structure";

export interface NodeSize {
  width: number;
  height: number;
}

function sizedWidth(node: GraphNode, base: number, minimum = 160, maximum = 560): number {
  const scale = { compact: 0.82, normal: 1, wide: 1.36 }[node.width ?? "normal"];
  return Math.min(maximum, Math.max(minimum, Math.round(base * scale)));
}

function automaticSizeForNode(node: GraphNode): NodeSize {
  const rich = Boolean(node.text || node.answer || node.feature);
  if (node.kind === "text") {
    const fontSize = node.fontSize ?? 18;
    const automaticWidth = Math.min(520, Math.max(180, Math.round(fontSize * 0.58 * Math.min(42, Math.max(12, node.label.length)) + 36)));
    const width = sizedWidth(node, automaticWidth, 160, 680);
    const charactersPerLine = Math.max(8, Math.floor((width - 28) / (fontSize * 0.56)));
    const labelLines = Math.max(1, Math.ceil(node.label.length / charactersPerLine));
    const detailLines = node.text ? Math.max(1, Math.ceil(node.text.length / Math.max(12, charactersPerLine * 1.35))) : 0;
    const categoryHeight = node.category ? 24 : 0;
    return { width, height: Math.max(64 + categoryHeight, Math.round(24 + categoryHeight + labelLines * fontSize * 1.3 + detailLines * Math.max(12, fontSize * 0.75) * 1.35)) };
  }
  if (node.kind === "neuron") {
    const diameter = sizedWidth(node, rich ? 164 : 126, 104, 212);
    return { width: diameter, height: diameter };
  }
  if (node.kind === "decision" || node.kind === "condition") {
    return rich
      ? { width: sizedWidth(node, 286, 230, 430), height: 190 }
      : { width: sizedWidth(node, 230, 188, 350), height: 144 };
  }
  if (["array", "stack", "queue", "list"].includes(node.kind)) {
    const itemCount = Math.max(1, dataItems(node).length);
    if (node.kind === "stack") {
      return { width: sizedWidth(node, rich ? 286 : 250), height: (rich ? 124 : 84) + itemCount * 22 };
    }
    return { width: sizedWidth(node, rich ? 286 : 250), height: rich ? 196 : 132 };
  }
  if (node.kind === "record") {
    const fieldCount = Math.max(1, dataFields(node).length);
    return {
      width: sizedWidth(node, rich ? 250 : 210),
      height: Math.max(rich ? 184 : 112, 56 + fieldCount * 22 + (rich ? 76 : 0)),
    };
  }
  if (node.kind === "item") return { width: sizedWidth(node, rich ? 250 : 210), height: rich ? 150 : 88 };
  if (node.kind === "pointer") return { width: sizedWidth(node, rich ? 220 : 178), height: rich ? 132 : 68 };
  if (["input", "output", "start", "return"].includes(node.kind) && !rich) return { width: sizedWidth(node, 212), height: 76 };
  const contentHeight = (node.text ? 50 : 0) + (node.answer ? 64 : 0) + (node.feature ? 30 : 0);
  const width = sizedWidth(node, rich ? 324 : 292);
  const labelCharactersPerLine = Math.max(22, Math.floor(44 * (width / 292)));
  return {
    width,
    height: Math.min(290, Math.max(96, 96 + Math.ceil(node.label.length / labelCharactersPerLine) * 20 + contentHeight)),
  };
}

export function sizeForNode(node: GraphNode, fontScale = 100): NodeSize {
  const automatic = automaticSizeForNode(node);
  let size = automatic;
  if (node.boxWidth && node.boxHeight && (node.kind === "neuron" || node.shape === "circle")) {
    const diameter = Math.max(node.boxWidth, node.boxHeight);
    size = { width: diameter, height: diameter };
  } else if (node.shape === "circle") {
    const contentLength = node.label.length + (node.text?.length ?? 0) + (node.answer?.length ?? 0) + (node.feature?.length ?? 0);
    const diameter = Math.min(420, Math.max(150, automatic.width, Math.ceil(Math.sqrt(contentLength) * 16 + 96)));
    size = { width: diameter, height: diameter };
  } else if (node.boxWidth && node.boxHeight) {
    size = { width: node.boxWidth, height: node.boxHeight };
  }
  const scale = fontScale / 100;
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}

export function calculateLayout(
  document: GraphDocument,
  direction: LayoutDirection,
): Record<string, Point> {
  const effectiveDirection =
    document.view === "tree" || document.view === "logic" || document.view === "algorithm"
      ? "TB"
      : document.view === "neural"
        ? "LR"
        : document.view === "data"
          ? "LR"
        : direction;
  const ranksep =
    document.view === "neural" ? 152 : document.view === "logic" || document.view === "algorithm" ? 100 : effectiveDirection === "LR" ? 104 : 82;
  const nodesep = document.view === "neural" ? 34 : document.view === "logic" || document.view === "algorithm" ? 58 : 38;
  const dagreGraph = new graphlib.Graph()
    .setGraph({
      rankdir: effectiveDirection,
      ranksep,
      nodesep,
      edgesep: 20,
      marginx: 32,
      marginy: 32,
    })
    .setDefaultEdgeLabel(() => ({}));

  for (const node of document.nodes) {
    const size = sizeForNode(node, document.fontScale);
    dagreGraph.setNode(node.id, {
      width: size.width,
      height: size.height,
    });
  }
  for (const edge of document.edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  layout(dagreGraph);

  return Object.fromEntries(
    document.nodes.map((node) => {
      const size = sizeForNode(node, document.fontScale);
      const position = dagreGraph.node(node.id) as { x: number; y: number };
      return [
        node.id,
        {
          x: position.x - size.width / 2,
          y: position.y - size.height / 2,
        },
      ];
    }),
  );
}
