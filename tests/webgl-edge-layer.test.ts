import { describe, expect, it } from "vitest";
import { edgeLabelMetrics, shouldUseWebGLEdges } from "../src/canvas/webgl-edge-layer";

describe("WebGL edge rendering", () => {
  it("keeps small diagrams on the interactive SVG renderer", () => {
    expect(shouldUseWebGLEdges(24, 32)).toBe(false);
    expect(shouldUseWebGLEdges(139, 89)).toBe(false);
  });

  it("moves edge-dense or node-dense diagrams to WebGL", () => {
    expect(shouldUseWebGLEdges(40, 90)).toBe(true);
    expect(shouldUseWebGLEdges(140, 30)).toBe(true);
  });

  it("keeps route labels readable at overview scales and grows them toward detail view", () => {
    expect(edgeLabelMetrics(0.02).visible).toBe(false);
    expect(edgeLabelMetrics(0.08)).toMatchObject({ visible: true, fontSize: 7.36, maxWidth: 60 });
    expect(edgeLabelMetrics(0.3).fontSize).toBeGreaterThan(edgeLabelMetrics(0.08).fontSize);
    expect(edgeLabelMetrics(0.3).fade).toBe(1);
    expect(edgeLabelMetrics(1).fontSize).toBe(12);
    expect(edgeLabelMetrics(1).maxWidth).toBe(160);
  });
});
