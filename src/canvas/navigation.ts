export const minCanvasScale = 0.01;
export const maxCanvasScale = 16;

export function adaptiveZoomFactor(scale: number): number {
  if (scale < 0.05) return 1.5;
  if (scale < 0.15) return 1.32;
  if (scale < 0.4) return 1.2;
  if (scale < 1) return 1.12;
  return 1.08;
}

export function nextWheelZoomScale(currentScale: number, deltaY: number): number {
  if (deltaY === 0) return currentScale;
  const direction = deltaY < 0 ? 1 : -1;
  const wheelStrength = Math.max(0.35, Math.min(2.5, Math.abs(deltaY) / 100));
  const nextScale = currentScale * adaptiveZoomFactor(currentScale) ** (direction * wheelStrength);
  return Math.max(minCanvasScale, Math.min(maxCanvasScale, nextScale));
}

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function intersectsWithOverscan(viewport: RectLike, bounds: RectLike, overscan: number): boolean {
  return (
    bounds.x + bounds.width >= viewport.x - overscan &&
    bounds.x <= viewport.x + viewport.width + overscan &&
    bounds.y + bounds.height >= viewport.y - overscan &&
    bounds.y <= viewport.y + viewport.height + overscan
  );
}
