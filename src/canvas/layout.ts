import { graphlib, layout } from "@dagrejs/dagre";
import type { LayoutDirection, Point } from "../app/app-store";
import type { GraphDocument, GraphNode } from "../domain/graph-document";
import { dataFields, dataItems } from "./data-structure";

export interface NodeSize {
  width: number;
  height: number;
}

export function sizeForNode(node: GraphNode): NodeSize {
  const rich = Boolean(node.text || node.answer || node.feature);
  if (node.kind === "neuron") return rich ? { width: 164, height: 164 } : { width: 126, height: 126 };
  if (node.kind === "decision" || node.kind === "condition") {
    return rich ? { width: 286, height: 190 } : { width: 230, height: 144 };
  }
  if (["array", "stack", "queue", "list"].includes(node.kind)) {
    const itemCount = Math.max(1, dataItems(node).length);
    if (node.kind === "stack") {
      return { width: rich ? 286 : 250, height: (rich ? 124 : 84) + itemCount * 22 };
    }
    return { width: rich ? 286 : 250, height: rich ? 196 : 132 };
  }
  if (node.kind === "record") {
    const fieldCount = Math.max(1, dataFields(node).length);
    return {
      width: rich ? 250 : 210,
      height: Math.max(rich ? 184 : 112, 56 + fieldCount * 22 + (rich ? 76 : 0)),
    };
  }
  if (node.kind === "item") return { width: rich ? 250 : 210, height: rich ? 150 : 88 };
  if (node.kind === "pointer") return { width: rich ? 220 : 178, height: rich ? 132 : 68 };
  if (["input", "output", "start", "return"].includes(node.kind) && !rich) return { width: 212, height: 76 };
  const contentHeight = (node.text ? 50 : 0) + (node.answer ? 64 : 0) + (node.feature ? 30 : 0);
  return {
    width: rich ? 324 : 292,
    height: Math.min(290, Math.max(96, 96 + Math.ceil(node.label.length / 44) * 20 + contentHeight)),
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
    const size = sizeForNode(node);
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
      const size = sizeForNode(node);
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
