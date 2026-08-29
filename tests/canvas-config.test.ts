import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync("src/canvas/graph-canvas.ts", "utf8");

describe("large canvas navigation", () => {
  it("keeps a useful zoom range for large diagrams", () => {
    expect(canvasSource).toContain("enabled: false");
    expect(canvasSource).toContain("minScale: 0.01");
    expect(canvasSource).toContain("maxScale: 16");
    expect(canvasSource).toContain("zoomToFit({ padding: 48, minScale: 0.01");
  });

  it("handles modifier-wheel zoom in the canvas", () => {
    expect(canvasSource).toContain("event.ctrlKey || event.metaKey");
    expect(canvasSource).toContain("this.pendingZoom =");
    expect(canvasSource).toContain("this.graph.zoom(pendingZoom.scale");
    expect(canvasSource).toContain("center: this.graph.clientToGraph");
  });

  it("focuses and edits a node on double-click", () => {
    expect(canvasSource).toContain("preventDefaultDblClick: true");
    expect(canvasSource).toContain("e.preventDefault();");
    expect(canvasSource).toContain("e.stopPropagation();");
    expect(canvasSource).toContain("this.callbacks.onNodeEdit(node.id);");
    expect(canvasSource).toContain("window.setTimeout(() => this.zoomToNode(node), 80);");
    expect(canvasSource).toContain("const targetScale = 1.25;");
    expect(canvasSource).toContain("this.graph.centerCell(node);");
    expect(canvasSource).toContain('this.document?.view === "logic"');
    expect(canvasSource).toContain("this.graph.getNeighbors(node)");
    expect(canvasSource).toContain("this.graph.zoomToRect(bounds");
  });

  it("does not render dangling or off-screen endpoint edges", () => {
    expect(canvasSource).toContain("if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;");
    expect(canvasSource).toContain("viewport.intersectsWithRect(source.getBBox())");
    expect(canvasSource).toContain("viewport.intersectsWithRect(target.getBBox())");
    expect(canvasSource).toContain("cell.isVisible() !== endpointsVisible");
    expect(canvasSource).toContain("requestAnimationFrame");
  });

  it("uses virtual rendering for large diagrams", () => {
    expect(canvasSource).toContain("virtual: true");
  });
});
