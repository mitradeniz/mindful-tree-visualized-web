import type { AppState } from './app-store';

// Ignore selection, zoom and the theme preference; track document content and layout.
export function projectFingerprint(state: Pick<AppState, 'source' | 'direction' | 'positions'>): string {
  return JSON.stringify([state.source, state.direction,
    Object.entries(state.positions).sort(([a], [b]) => a.localeCompare(b))]);
}
