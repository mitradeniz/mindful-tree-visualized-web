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

  it("centers the canvas from an exact minimap point while clicking or dragging", () => {
    expect(canvasSource).toContain("scalable: false");
    expect(canvasSource).toContain("onMinimapPointerDown");
    expect(canvasSource).toContain("onMinimapPointerMove");
    expect(canvasSource).toContain("onMinimapMouseDown");
    expect(canvasSource).toContain("this.minimapContainer.setPointerCapture(event.pointerId)");
    expect(canvasSource).toContain("const matrix = minimapGraph.matrix()");
    expect(canvasSource).toContain("const content = this.graph.getContentArea()");
    expect(canvasSource).toContain("this.graph.centerPoint(targetX, targetY)");
  });

  it("supports mobile pan, pinch zoom, and touch selection", () => {
    expect(canvasSource).toContain("private readonly activeTouches");
    expect(canvasSource).toContain("onCanvasPointerMove");
    expect(canvasSource).toContain("this.graph.translateBy(pending.dx, pending.dy)");
    expect(canvasSource).toContain("currentDistance / previousDistance");
    expect(canvasSource).toContain("this.graph.zoom(pending.scale");
    expect(canvasSource).toContain("touchDoubleTapDelay");
  });

  it("opens editing on one click and gives a node readable focus on double-click", () => {
    expect(canvasSource).toContain("preventDefaultDblClick: true");
    expect(canvasSource).toContain("event.preventDefault();");
    expect(canvasSource).toContain("event.stopImmediatePropagation();");
    expect(canvasSource).toContain("this.callbacks.onNodeEdit(node.id);");
    expect(canvasSource).toContain("this.lastNodeClick?.nodeId === node.id");
    expect(canvasSource).toContain("this.handleNodeDoubleClick(node, e.target, e.altKey);");
    expect(canvasSource).toContain("this.openInlineTitleEditor(node);");
    expect(canvasSource).toContain("const targetScale = 1.6;");
    expect(canvasSource).toContain("absolute: true");
    expect(canvasSource).toContain("this.graph.centerCell(node);");
    expect(canvasSource).toContain("node.getBBox().getCenter()");
  });

  it("resizes selected nodes from edge and corner handles", () => {
    expect(canvasSource).toContain('const resizeDirections: ResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]');
    expect(canvasSource).toContain("onResizeHandlePointerDown");
    expect(canvasSource).toContain("this.callbacks.onNodeResize(");
    expect(canvasSource).toContain("width: Math.round(session.nextSize.width / fontScale)");
    expect(canvasSource).toContain('sourceNode.kind === "neuron" || sourceNode.shape === "circle"');
  });

  it("applies the diagram-wide font scale to every node shape", () => {
    expect(canvasSource).toContain("private scaleNodeMetadata(metadata: Node.Metadata)");
    expect(canvasSource).toContain("(this.document?.fontScale ?? 100) / 100");
    expect(canvasSource).toContain('["x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "fontSize", "letterSpacing"]');
    expect(canvasSource).toContain("textWrap.width *= scale");
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

  it("refreshes light node palettes without exposing edges below them", () => {
    expect(canvasSource).toContain("refreshTheme(): void");
    expect(canvasSource).toContain("cell.setAttrs(attrs)");
    expect(canvasSource).toContain("compositeColor(colors.stroke, lightCanvasColor, 0.16)");
    expect(canvasSource).toContain('cell.attr("body/opacity", 1)');
    expect(canvasSource).toContain('cell.attr("body/strokeOpacity", matches ? 1 : 0.28)');
  });
});
