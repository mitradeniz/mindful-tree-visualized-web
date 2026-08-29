import type { GraphDocument } from "../domain/graph-document";
import type { Diagnostic } from "../scripting/diagnostic";

export type LayoutDirection = "LR" | "TB";
export type Theme = "light" | "dark";

export interface Point {
  x: number;
  y: number;
}

export interface AppState {
  source: string;
  document: GraphDocument | null;
  diagnostics: Diagnostic[];
  selectedNodeId: string | null;
  direction: LayoutDirection;
  theme: Theme;
  positions: Record<string, Point>;
  search: string;
}

type Listener = (state: Readonly<AppState>) => void;

export class AppStore {
  private state: AppState;
  private readonly listeners = new Set<Listener>();

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  get(): Readonly<AppState> {
    return this.state;
  }

  update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
