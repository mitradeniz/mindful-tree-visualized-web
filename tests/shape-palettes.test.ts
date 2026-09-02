import { describe, expect, it } from "vitest";
import { diagramViews, type DiagramView, type GraphDocument, type GraphNode, type NodeKind } from "../src/domain/graph-document";
import { dataShapePalettes, shapePaletteForDocument, shapePalettes } from "../src/playground/shape-palettes";

const source = {
  from: { offset: 0, line: 1, column: 1 },
  to: { offset: 1, line: 1, column: 2 },
};

function node(id: string, kind: NodeKind): GraphNode {
  return { id, kind, label: id, tags: [], priority: "normal", source };
}

function documentFor(view: DiagramView, nodes: GraphNode[] = []): GraphDocument {
  return {
    version: "0.1",
    id: `${view}_diagram`,
    title: view,
    view,
    fontScale: 100,
    nodes,
    edges: [],
  };
}

describe("shape palettes", () => {
  it("provides a sizeable, unique semantic palette for every diagram category", () => {
    for (const view of diagramViews) {
      const palette = shapePalettes[view];
      expect(palette.length, view).toBeGreaterThanOrEqual(5);
      expect(new Set(palette.map((preset) => preset.id)).size, view).toBe(palette.length);
    }
  });

  it("uses diagram-specific node kinds instead of a shared four-shape palette", () => {
    expect(shapePalettes.tree.map((preset) => preset.kind)).toEqual(expect.arrayContaining(["topic", "question", "response", "followup"]));
    expect(shapePalettes.flow.map((preset) => preset.kind)).toEqual(expect.arrayContaining(["start", "process", "decision", "outcome"]));
    expect(shapePalettes.neural.map((preset) => preset.kind)).toEqual(expect.arrayContaining(["input", "layer", "neuron", "output"]));
    expect(shapePalettes.algorithm.map((preset) => preset.kind)).toEqual(expect.arrayContaining(["function", "operation", "condition", "loop", "return"]));
    expect(shapePalettes.data.map((preset) => preset.kind)).toEqual(expect.arrayContaining(["array", "stack", "queue", "list", "record", "pointer"]));
  });

  it("offers ready-to-use structures inside each category", () => {
    expect(shapePalettes.tree.map((preset) => preset.id)).toEqual(expect.arrayContaining(["tree-root", "tree-branch", "tree-leaf"]));
    expect(shapePalettes.flow.map((preset) => preset.id)).toEqual(expect.arrayContaining(["flow-decision", "flow-loop", "flow-parallel"]));
    expect(shapePalettes.logic.map((preset) => preset.id)).toEqual(expect.arrayContaining(["logic-and", "logic-or", "logic-not", "logic-xor"]));
    expect(shapePalettes.algorithm.map((preset) => preset.id)).toEqual(expect.arrayContaining(["algorithm-for", "algorithm-while", "algorithm-recursion"]));
    expect(shapePalettes.data.map((preset) => preset.id)).toEqual(expect.arrayContaining(["data-hash-map", "data-min-heap", "data-binary-tree", "data-set", "data-graph"]));
  });

  it("ships useful starter content with specialized presets", () => {
    const andGate = shapePalettes.logic.find((preset) => preset.id === "logic-and");
    const heap = shapePalettes.data.find((preset) => preset.id === "data-min-heap");
    expect(andGate).toMatchObject({ label: "AND gate", feature: "Gate: A ∧ B" });
    expect(heap).toMatchObject({ kind: "array", items: ["1", "3", "5", "8"] });
  });

  it("changes the data palette to match the selected structure", () => {
    const graph = documentFor("data", [node("scores", "array"), node("undo", "stack")]);

    expect(shapePaletteForDocument(graph, "scores")).toBe(dataShapePalettes.array);
    expect(shapePaletteForDocument(graph, "undo")).toBe(dataShapePalettes.stack);
    expect(shapePaletteForDocument(graph, null)).toBe(shapePalettes.data);
  });

  it("keeps presets with the same visual shape independently addressable", () => {
    const cards = shapePalettes.algorithm.filter((preset) => preset.shape === "card");
    expect(cards.map((preset) => preset.kind)).toEqual(expect.arrayContaining(["function", "operation"]));
    expect(new Set(cards.map((preset) => preset.id)).size).toBe(cards.length);
  });
});
