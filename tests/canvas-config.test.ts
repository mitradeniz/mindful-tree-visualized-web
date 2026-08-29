import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync("src/canvas/graph-canvas.ts", "utf8");

describe("large canvas navigation", () => {
  it("keeps a useful zoom range for large diagrams", () => {
    expect(canvasSource).toContain("enabled: false");
    expect(canvasSource).toContain("minScale: minCanvasScale");
    expect(canvasSource).toContain("maxScale: maxCanvasScale");
    expect(canvasSource).toContain("zoomToFit({ padding: 48, minScale: 0.01");
  });

  it("handles modifier-wheel zoom in the canvas", () => {
    expect(canvasSource).toContain("event.ctrlKey || event.metaKey");
    expect(canvasSource).toContain("this.pendingZoom =");
    expect(canvasSource).toContain("nextWheelZoomScale(currentScale, event.deltaY)");
    expect(canvasSource).toContain("this.graph.zoom(pendingZoom.scale");
    expect(canvasSource).toContain("center: this.graph.clientToGraph");
  });

  it("supports mobile pan, pinch zoom, and touch selection", () => {
    expect(canvasSource).toContain("private readonly activeTouches");
    expect(canvasSource).toContain("onCanvasPointerMove");
    expect(canvasSource).toContain("this.graph.translateBy(pending.dx, pending.dy)");
    expect(canvasSource).toContain("currentDistance / previousDistance");
    expect(canvasSource).toContain("this.graph.zoom(pending.scale");
    expect(canvasSource).toContain("touchDoubleTapDelay");
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

  it("does not render dangling edges and keeps nearby connections stable", () => {
    expect(canvasSource).toContain("if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;");
    expect(canvasSource).toContain("const shouldCull = this.document.nodes.length > virtualNodeThreshold");
    expect(canvasSource).toContain("intersectsWithOverscan(viewport, cell.getBBox(), overscan)");
    expect(canvasSource).toContain("intersectsWithOverscan(viewport, source.getBBox(), overscan)");
    expect(canvasSource).toContain("intersectsWithOverscan(viewport, target.getBBox(), overscan)");
    expect(canvasSource).toContain("cell.isVisible() !== visible");
    expect(canvasSource).toContain("requestAnimationFrame");
  });

  it("uses virtual rendering for large diagrams", () => {
    expect(canvasSource).toContain("virtual: true");
    expect(canvasSource).toContain("const virtualNodeThreshold = 200");
    expect(canvasSource).toContain("document.nodes.length > virtualNodeThreshold");
    expect(canvasSource).toContain("this.graph.disableVirtualRender()");
  });

  it("refreshes translucent node palettes when the theme changes", () => {
    expect(canvasSource).toContain("refreshTheme(): void");
    expect(canvasSource).toContain("cell.setAttrs(attrs)");
    expect(canvasSource).toContain("translucentColor(colors.stroke, 0.16)");
  });
});
