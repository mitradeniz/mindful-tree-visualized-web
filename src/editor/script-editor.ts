import { defaultKeymap, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { forceLinting, lintGutter, linter, type Diagnostic as EditorDiagnostic } from "@codemirror/lint";
import { searchKeymap } from "@codemirror/search";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, type DecorationSet } from "@codemirror/view";
import { basicSetup } from "codemirror";
import type { Diagnostic } from "../scripting/diagnostic";
import { branchScript } from "./branchscript-language";

interface EditorCallbacks {
  onChange: (source: string) => void;
  onCursor: (offset: number) => void;
}

interface SourceRange {
  from: number;
  to: number;
}

const setNodeHighlights = StateEffect.define<SourceRange[]>();
const nodeHighlights = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(highlights, transaction) {
    highlights = highlights.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setNodeHighlights)) continue;
      const length = transaction.state.doc.length;
      const lineStarts = new Set<number>();
      for (const range of effect.value) {
        const from = Math.max(0, Math.min(range.from, length));
        const to = Math.max(from, Math.min(range.to, length));
        const firstLine = transaction.state.doc.lineAt(from).number;
        const lastLine = transaction.state.doc.lineAt(Math.max(from, to - 1)).number;
        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
          lineStarts.add(transaction.state.doc.line(lineNumber).from);
        }
      }
      return Decoration.set(
        [...lineStarts]
          .sort((left, right) => left - right)
          .map((from) => Decoration.line({ class: "cm-node-selection-line" }).range(from)),
      );
    }
    return highlights;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export class ScriptEditor {
  private readonly view: EditorView;
  private diagnostics: Diagnostic[] = [];

  constructor(private readonly container: HTMLElement, source: string, callbacks: EditorCallbacks) {
    const diagnosticsSource = linter(() => this.toEditorDiagnostics());
    this.view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: source,
        extensions: [
          basicSetup,
          branchScript(),
          nodeHighlights,
          lintGutter(),
          diagnosticsSource,
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.onChange(update.state.doc.toString());
            if (update.selectionSet) callbacks.onCursor(update.state.selection.main.head);
          }),
        ],
      }),
    });
    this.resetViewport();
  }

  setDiagnostics(diagnostics: Diagnostic[]): void {
    this.diagnostics = diagnostics;
    forceLinting(this.view);
  }

  setValue(source: string, options: { scrollToTop?: boolean } = {}): void {
    const current = this.view.state.doc.toString();
    if (current === source && !options.scrollToTop) return;
    this.view.dispatch({
      ...(current === source ? {} : { changes: { from: 0, to: current.length, insert: source } }),
      ...(options.scrollToTop ? { selection: { anchor: 0 } } : {}),
    });
    if (options.scrollToTop) this.resetViewport();
  }

  reveal(from: number, to = from): void {
    const safeFrom = Math.max(0, Math.min(from, this.view.state.doc.length));
    const safeTo = Math.max(safeFrom, Math.min(to, this.view.state.doc.length));
    this.view.dispatch({
      selection: { anchor: safeFrom, head: safeTo },
      effects: EditorView.scrollIntoView(safeFrom, { y: "center" }),
    });
    this.view.focus();
  }

  showNodeSelections(ranges: SourceRange[]): void {
    const length = this.view.state.doc.length;
    const safeRanges = ranges.map((range) => ({
      from: Math.max(0, Math.min(range.from, length)),
      to: Math.max(0, Math.min(range.to, length)),
    }));
    const highlightEffect = setNodeHighlights.of(safeRanges);
    const first = safeRanges[0];
    this.view.dispatch({
      effects: first ? [highlightEffect, EditorView.scrollIntoView(first.from, { y: "center" })] : highlightEffect,
    });
  }

  undo(): void {
    undo(this.view);
  }

  redo(): void {
    redo(this.view);
  }

  focus(): void {
    this.view.focus();
  }

  dispose(): void {
    this.view.destroy();
  }

  private resetViewport(): void {
    const reset = () => {
      this.container.scrollTop = 0;
      this.container.scrollLeft = 0;
      this.view.scrollDOM.scrollTop = 0;
      this.view.scrollDOM.scrollLeft = 0;
    };
    reset();
    window.requestAnimationFrame(reset);
  }

  private toEditorDiagnostics(): EditorDiagnostic[] {
    const length = this.view.state.doc.length;
    return this.diagnostics.map((item) => ({
      from: Math.max(0, Math.min(item.from, length)),
      to: Math.max(0, Math.min(Math.max(item.to, item.from + 1), length)),
      severity: item.severity,
      message: item.message,
    }));
  }
}
