import { describe, expect, it } from "vitest";
import {
  adaptiveZoomFactor,
  intersectsWithOverscan,
  maxCanvasScale,
  minCanvasScale,
  nextWheelZoomScale,
  zoomDetailLevel,
} from "../src/canvas/navigation";

describe("canvas navigation", () => {
  it("zooms more aggressively when the diagram is very far away", () => {
    expect(adaptiveZoomFactor(0.02)).toBeGreaterThan(adaptiveZoomFactor(1));
    expect(nextWheelZoomScale(0.02, -100) / 0.02).toBeGreaterThan(nextWheelZoomScale(1, -100));
  });

  it("keeps wheel zoom within the supported scale range", () => {
    expect(nextWheelZoomScale(minCanvasScale, 10_000)).toBe(minCanvasScale);
    expect(nextWheelZoomScale(maxCanvasScale, -10_000)).toBe(maxCanvasScale);
  });

  it("reduces SVG detail as large diagrams zoom out", () => {
    expect(zoomDetailLevel(0.05)).toBe("overview");
    expect(zoomDetailLevel(0.25)).toBe("compact");
    expect(zoomDetailLevel(1)).toBe("detail");
  });

  it("treats connection bounds near the viewport as visible", () => {
    const viewport = { x: 100, y: 100, width: 400, height: 300 };
    expect(intersectsWithOverscan(viewport, { x: 530, y: 180, width: 40, height: 40 }, 80)).toBe(true);
    expect(intersectsWithOverscan(viewport, { x: 900, y: 180, width: 40, height: 40 }, 80)).toBe(false);
  });
});
