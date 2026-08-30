import defaultSource from "../../examples/software-interview.mtree?raw";
import { z } from "zod";
import type { Point } from "./app-store";
import { AppStore } from "./app-store";
import {
  authErrorMessage,
  createDiagram,
  deleteDiagram,
  getDiagram,
  getSession,
  listDiagrams,
  login,
  logout,
  register,
  resendVerification,
  updateDiagram,
  verifyEmail,
  type BranchScriptUser,
  type CloudDiagram,
  type CloudDiagramSummary,
} from "../auth/cloud-api";
import { GraphCanvas } from "../canvas/graph-canvas";
import type { DiagramView, GraphDocument, GraphNode, NodeKind, NodeShape } from "../domain/graph-document";
import { ScriptEditor } from "../editor/script-editor";
import { getLocale, localeOptions, localizeElement, setLocale, t, type Locale } from "../i18n";
import {
  blankProjectSource,
  playgroundPresets,
  presetById,
  presetsForView,
  primaryPlaygroundPresets,
} from "../playground/presets";
import { compileMindTree } from "../scripting/compiler";
import type { Diagnostic } from "../scripting/diagnostic";
import { loadProject, saveProject, type SavedProject } from "../storage/project-storage";

interface ExportBundle {
  format: "branchscript-project";
  version: "0.1";
  sourceName: string;
  source: string;
  workspace: {
    direction: "LR" | "TB";
    positions: Record<string, Point>;
    theme: "light" | "dark";
  };
}

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
}

interface SourcePanelLayout {
  ratio: number;
  collapsed: boolean;
}

interface ShapePalettePreset {
  shape: NodeShape;
  kind: NodeKind;
  name: string;
  shapeName: string;
  label: string;
  keepNativeShape?: boolean;
}

const defaultShapePalette: readonly ShapePalettePreset[] = [
  { shape: "card", kind: "process", name: "Step", shapeName: "Card", label: "New step" },
  { shape: "pill", kind: "start", name: "Start", shapeName: "Pill", label: "New start" },
  { shape: "diamond", kind: "decision", name: "Choice", shapeName: "Diamond", label: "New decision" },
  { shape: "circle", kind: "neuron", name: "Node", shapeName: "Circle", label: "New node" },
];

const shapePalettes: Partial<Record<DiagramView, readonly ShapePalettePreset[]>> = {
  flow: [
    { shape: "card", kind: "process", name: "Step", shapeName: "Process", label: "New step" },
    { shape: "pill", kind: "input", name: "Input", shapeName: "Input", label: "New input" },
    { shape: "diamond", kind: "decision", name: "Choice", shapeName: "Decision", label: "New decision" },
    { shape: "circle", kind: "outcome", name: "Result", shapeName: "Outcome", label: "New result" },
  ],
  neural: [
    { shape: "card", kind: "input", name: "Input", shapeName: "Signal", label: "New input" },
    { shape: "pill", kind: "layer", name: "Layer", shapeName: "Layer", label: "New layer" },
    { shape: "diamond", kind: "output", name: "Output", shapeName: "Output", label: "New output" },
    { shape: "circle", kind: "neuron", name: "Neuron", shapeName: "Neuron", label: "New neuron" },
  ],
  logic: [
    { shape: "card", kind: "input", name: "Input", shapeName: "Input", label: "New input" },
    { shape: "pill", kind: "outcome", name: "Result", shapeName: "Result", label: "New result" },
    { shape: "diamond", kind: "decision", name: "Choice", shapeName: "Decision", label: "New decision" },
    { shape: "circle", kind: "note", name: "Note", shapeName: "Note", label: "New note" },
  ],
  algorithm: [
    { shape: "card", kind: "operation", name: "Step", shapeName: "Operation", label: "New step" },
    { shape: "pill", kind: "start", name: "Start", shapeName: "Start", label: "New start" },
    { shape: "diamond", kind: "condition", name: "Choice", shapeName: "Condition", label: "New decision" },
    { shape: "circle", kind: "return", name: "Result", shapeName: "Return", label: "New result" },
  ],
  data: [
    { shape: "card", kind: "array", name: "Array", shapeName: "Collection", label: "New array", keepNativeShape: true },
    { shape: "pill", kind: "queue", name: "Queue", shapeName: "Queue", label: "New queue", keepNativeShape: true },
    { shape: "diamond", kind: "record", name: "Record", shapeName: "Record", label: "New record", keepNativeShape: true },
    { shape: "circle", kind: "pointer", name: "Pointer", shapeName: "Reference", label: "New pointer", keepNativeShape: true },
  ],
};

const sourcePanelLayoutKey = "branchscript-source-panel-layout";
const maxImportBytes = 1_048_576;
const importPointSchema = z.object({
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
});
const importPositionsSchema = z
  .record(z.string().regex(/^[A-Za-z][\w-]*$/).max(80), importPointSchema)
  .refine((positions) => Object.keys(positions).length <= 5_000);
const importBundleSchema = z
  .object({
    format: z.literal("branchscript-project"),
    version: z.literal("0.1"),
    sourceName: z.string().min(1).max(120).optional(),
    source: z.string().max(1_000_000),
    workspace: z
      .object({
        direction: z.enum(["LR", "TB"]),
        positions: importPositionsSchema,
        theme: z.enum(["light", "dark"]),
      })
      .optional(),
  })
  .strict();

export class BranchScriptApp {
  private readonly store = new AppStore({
    source: defaultSource,
    document: null,
    diagnostics: [],
    selectedNodeId: null,
    direction: "LR",
    theme: "dark",
    positions: {},
    search: "",
  });

  private editor: ScriptEditor | null = null;
  private canvas: GraphCanvas | null = null;
  private compileTimer: number | null = null;
  private saveTimer: number | null = null;
  private runnerOpen = false;
  private runPath: string[] = [];
  private user: BranchScriptUser | null = null;
  private cloudDiagrams: CloudDiagramSummary[] = [];
  private currentCloudDiagram: CloudDiagram | null = null;
  private contextNodeId: string | null = null;
  private confirmationResolver: ((accepted: boolean) => void) | null = null;
  private confirmationPreviousFocus: HTMLElement | null = null;
  private sourcePanelRatio = 0.39;
  private sourcePanelCollapsed = false;
  private sourcePanelPointerId: number | null = null;
  private editingNodeId: string | null = null;
  private quickEditorTimer: number | null = null;
  private syncingQuickEditor = false;
  private searchResultIndex = -1;
  private searchResultQuery = "";
  private pendingShape: NodeShape | null = null;
  private sourceName = "software-interview.mtree";

  constructor(private readonly root: HTMLElement) {}

  async mount(): Promise<void> {
    const saved = await this.safeLoad();
    if (saved) {
      this.sourceName = this.normalizeSourceName(saved.sourceName ?? this.sourceNameFor(saved.source));
      this.store.update({
        source: saved.source,
        direction: saved.direction,
        positions: saved.positions,
        theme: saved.theme,
      });
    }
    this.restoreSourcePanelLayout();

    this.root.innerHTML = this.template();
    localizeElement(this.root);
    this.updateSourceName();
    this.applyTheme();

    const editorElement = this.requireElement("script-editor");
    const canvasElement = this.requireElement("graph-canvas");
    const minimapElement = this.requireElement("minimap");

    this.editor = new ScriptEditor(editorElement, this.store.get().source, {
      onChange: (source) => this.onSourceChange(source),
      onCursor: (offset) => this.onCursor(offset),
    });
    this.canvas = new GraphCanvas(canvasElement, minimapElement, {
      onSelect: (nodeIds) => this.onNodesSelected(nodeIds),
      onQuickAdd: () => this.openQuickBuilder(),
      onCanvasTap: (position) => this.placePendingShape(position),
      onNodeEdit: (nodeId) => this.openNodeEditor(nodeId),
      onConnect: (sourceId, targetId) => this.addDirectConnection(sourceId, targetId),
      onNodeTitleChange: (nodeId, label) => this.renameNode(nodeId, label),
      onNodeResize: (nodeId, size, position) => this.resizeNode(nodeId, size, position),
      onContextMenu: (request) => this.openCanvasContextMenu(request),
      onPositionsChange: (positions) => {
        this.store.update({ positions });
        this.scheduleSave();
      },
    });

    this.bindControls();
    this.applySourcePanelLayout();
    this.compile(true);
    this.updateStatus("Ready", "ok");
    void this.refreshSession(true);
  }

  private template(): string {
    return `
      <main class="app-shell">
        <header class="topbar">
          <div class="brand-block">
            <img class="brand-mark" src="/branchscript-mark.svg" alt="" width="38" height="38" />
            <div>
              <h1>BranchScript</h1>
              <p>Script your thoughts. See them grow.</p>
            </div>
          </div>
          <div class="topbar-actions" aria-label="Project actions">
            <a class="button ghost app-home-link" href="/">Home</a>
            <button class="button cloud-action" id="cloud-save-button" type="button">Save project</button>
            <button class="button ghost account-action" id="account-button" type="button">Sign in</button>
            <button class="button ghost" id="guide-button" type="button">Learn</button>
            <button class="button ghost" id="template-library-button" type="button">Examples</button>
            <button class="button ghost" id="import-button" type="button">Import .mtree / .json</button>
            <button class="button ghost" id="export-source-button" type="button">Export .mtree</button>
            <button class="button ghost" id="export-project-button" type="button">Export workspace .json</button>
            <label class="language-control">
              <span class="sr-only">Language</span>
              <select id="language-select" aria-label="Language">
                ${localeOptions.map((option) => `<option value="${option.value}"${option.value === getLocale() ? " selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </label>
            <button class="icon-button" id="theme-button" type="button" aria-label="Toggle theme">◐</button>
            <input id="file-input" type="file" accept=".mtree,.branchscript.json,.json,text/plain,application/json" hidden />
          </div>
        </header>

        <nav class="preset-dock" aria-label="Playground templates">
          <div class="preset-intro">
            <span class="eyebrow">PLAYGROUND</span>
            <strong>Choose a visual language</strong>
            <span>Every card loads a live <code>.mtree</code> example.</span>
          </div>
          <div class="preset-list">
            <button class="preset-card preset-card-blank" id="blank-project-button" type="button" aria-label="Start blank project">
              <span class="preset-visual blank" aria-hidden="true"><span class="blank-plus">＋</span></span>
              <span class="preset-copy"><strong>Blank project</strong><small>Start with an empty canvas.</small></span>
            </button>
            ${primaryPlaygroundPresets.map((preset) => this.presetCard(preset.view, preset.shortTitle, preset.description)).join("")}
            <button class="preset-card preset-card-coming-soon" type="button" disabled aria-label="${t("System Design")}: ${t("Coming soon")}">
              <span class="preset-visual system-design" aria-hidden="true"><span class="motif-node system-a"></span><span class="motif-node system-b"></span><span class="motif-node system-c"></span><span class="motif-node system-d"></span></span>
              <span class="preset-copy"><strong>${t("System Design")}</strong><small>${t("Coming soon")} · ${t("Architecture maps for services, data, and trade-offs.")}</small></span>
            </button>
          </div>
        </nav>

        <section class="workspace" data-mobile-view="canvas">
          <nav class="mobile-view-tabs" aria-label="Mobile workspace view">
            <button class="mobile-view-tab" type="button" data-mobile-view-button="source" aria-pressed="false">Source</button>
            <button class="mobile-view-tab" type="button" data-mobile-view-button="canvas" aria-pressed="true">Canvas</button>
          </nav>
          <aside class="editor-panel" aria-label="BranchScript editor">
            <div class="panel-header">
              <div>
                <span class="eyebrow">SOURCE</span>
                <strong id="source-file-name"></strong>
              </div>
              <div class="compact-actions">
                <button class="button ghost compact" id="editor-guide-button" type="button">Syntax guide</button>
                <button class="icon-button" id="editor-undo" type="button" aria-label="Undo script edit">↶</button>
                <button class="icon-button" id="editor-redo" type="button" aria-label="Redo script edit">↷</button>
                <button class="icon-button" id="hide-source-button" type="button" aria-label="Hide source panel">×</button>
              </div>
            </div>
            <div id="script-editor" class="script-editor"></div>
            <section class="diagnostics" aria-label="Script diagnostics">
              <div class="diagnostics-heading">
                <strong>Diagnostics</strong>
                <span id="diagnostic-count" class="count-pill">0</span>
              </div>
              <div id="diagnostic-list" class="diagnostic-list">
                <p class="empty-message">No syntax errors.</p>
              </div>
            </section>
          </aside>

          <div id="workspace-resizer" class="workspace-resizer" role="separator" aria-label="Resize source panel" aria-orientation="vertical" aria-valuemin="25" aria-valuemax="70" aria-valuenow="39" tabindex="0"></div>

          <section class="canvas-panel" aria-label="Thought tree canvas">
            <div class="canvas-toolbar">
              <div class="canvas-toolbar-start">
                <button class="button ghost compact" id="show-source-button" type="button" aria-label="Show source panel" hidden><span aria-hidden="true">‹/›</span> <span>Source</span></button>
                <label class="search-control">
                  <span aria-hidden="true">⌕</span>
                  <input id="node-search" type="search" placeholder="Search nodes" autocomplete="off" />
                  <output id="node-search-status" aria-live="polite"></output>
                </label>
              </div>
              <div class="toolbar-group">
                <button class="button primary compact" id="add-node-button" type="button" aria-label="Open visual builder">＋ Add</button>
                <label class="global-font-control" title="Font size">
                  <span aria-hidden="true">Aa</span>
                  <select id="global-font-scale" aria-label="Font size">
                    <option value="85">85%</option>
                    <option value="100" selected>100%</option>
                    <option value="115">115%</option>
                    <option value="130">130%</option>
                    <option value="145">145%</option>
                  </select>
                </label>
                <button class="button ghost compact" id="direction-button" type="button">Left → right</button>
                <button class="button ghost compact" id="layout-button" type="button">Auto layout</button>
                <button class="button ghost compact" id="fit-button" type="button">Fit view</button>
                <button class="button ghost compact fullscreen-button" id="fullscreen-button" type="button" aria-label="Full screen"><span aria-hidden="true">⛶</span><span class="fullscreen-label">Full screen</span></button>
                <button class="button live compact" id="live-run-button" type="button">▶ Live run</button>
                <button class="icon-button" id="canvas-undo" type="button" aria-label="Undo canvas move">↶</button>
                <button class="icon-button" id="canvas-redo" type="button" aria-label="Redo canvas move">↷</button>
              </div>
            </div>
            <div id="graph-canvas" class="graph-canvas"></div>
            <div id="shape-placement-cue" class="shape-placement-cue" hidden>
              <span id="shape-placement-label"></span>
              <button class="icon-button" id="shape-placement-cancel" type="button" aria-label="Cancel shape placement">×</button>
            </div>
            <div id="canvas-context-menu" class="canvas-context-menu" role="menu" aria-label="Canvas actions" hidden>
              <button type="button" role="menuitem" data-context-action="add">＋ Add box here</button>
              <button type="button" role="menuitem" data-context-action="add-connected" data-node-context>Add connected box</button>
              <button type="button" role="menuitem" data-context-action="source" data-node-context>Show in source</button>
              <span class="context-menu-divider" aria-hidden="true"></span>
              <button type="button" role="menuitem" data-context-action="layout">Auto layout</button>
              <button type="button" role="menuitem" data-context-action="fit">Fit view</button>
            </div>
            <div id="minimap" class="minimap" aria-label="Canvas minimap"></div>
            <aside id="node-inspector" class="node-inspector" aria-live="polite">
              <span class="eyebrow">SELECTION</span>
              <p>Select a node to inspect its source.</p>
            </aside>
            <aside id="playground-runner" class="playground-runner" aria-live="polite" hidden>
              <header class="runner-header">
                <div>
                  <span class="eyebrow">LIVE PLAYGROUND</span>
                  <strong id="runner-title">Run the current flow</strong>
                </div>
                <button class="icon-button" id="runner-close" type="button" aria-label="Close live playground">×</button>
              </header>
              <div id="runner-body" class="runner-body"></div>
              <footer class="runner-footer">
                <button class="button ghost compact" id="runner-back" type="button">Back</button>
                <button class="button ghost compact" id="runner-reset" type="button">Reset</button>
              </footer>
            </aside>
            <aside id="quick-builder" class="side-panel quick-builder" aria-labelledby="quick-builder-title" hidden>
              <header class="side-panel-header">
                <div>
                  <span class="eyebrow">VISUAL BUILDER</span>
                  <strong id="quick-builder-title">Add without scripting</strong>
                </div>
                <button class="icon-button" id="quick-builder-close" type="button" aria-label="Close visual builder">×</button>
              </header>
              <section class="shape-palette" id="shape-palette" aria-labelledby="shape-palette-title">
                <div class="shape-palette-heading">
                  <strong id="shape-palette-title">Drag shapes onto the canvas</strong>
                  <span>Drag to place. On touch, choose a shape and tap the canvas.</span>
                </div>
                <div class="shape-palette-list">
                  ${this.shapePaletteMarkup()}
                </div>
              </section>
              <form id="quick-node-form" class="quick-form">
                <p class="builder-intro field-wide">Start with the box text and type. You can add answers, links, and visual details later.</p>
                <label class="field field-wide">
                  <span>Box text</span>
                  <input id="quick-label" name="label" required maxlength="160" placeholder="What happens here?" autocomplete="off" />
                </label>
                <label class="field field-wide">
                  <span>Type</span>
                  <select id="quick-kind" name="kind">
                    <option value="question">Question</option>
                    <option value="response">Response</option>
                    <option value="process" selected>Step</option>
                    <option value="decision">Choice</option>
                    <option value="outcome">Result</option>
                    <option value="note">Note</option>
                    <option value="text">Text block</option>
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                    <option value="neuron">Neuron</option>
                    <option value="start">Algorithm start</option>
                    <option value="function">Function</option>
                    <option value="operation">Operation</option>
                    <option value="condition">Condition</option>
                    <option value="loop">Loop</option>
                    <option value="return">Return</option>
                    <option value="array">Array</option>
                    <option value="item">Data item</option>
                    <option value="stack">Stack</option>
                    <option value="queue">Queue</option>
                    <option value="list">Linked list</option>
                    <option value="record">Record</option>
                    <option value="pointer">Pointer</option>
                  </select>
                </label>
                <label class="field field-wide">
                  <span>Supporting text</span>
                  <textarea id="quick-text" name="text" maxlength="420" rows="3" placeholder="Context, reminder, or explanation shown inside the box"></textarea>
                </label>
                <button class="button ghost field-wide advanced-toggle" id="quick-advanced-toggle" type="button" aria-expanded="false" aria-controls="quick-advanced-settings quick-connect-section">Show more options</button>
                <div id="quick-advanced-settings" class="quick-advanced field-wide" hidden>
                  <label class="field field-wide">
                    <span>Prepared answer</span>
                    <textarea id="quick-answer" name="answer" maxlength="600" rows="4" placeholder="The concise answer you want to recall during practice"></textarea>
                  </label>
                  <label class="field field-wide">
                    <span>Relevant property</span>
                    <input id="quick-feature" name="feature" maxlength="120" placeholder="Follow-up cue, rule, complexity, signal, or operation" autocomplete="off" />
                  </label>
                  <label class="field" id="quick-parent-field">
                    <span>Connect after</span>
                    <select id="quick-parent" name="parent"><option value="">No connection</option></select>
                  </label>
                  <label class="field">
                    <span>Color</span>
                    <select id="quick-color" name="color">
                      <option value="">Automatic</option>
                      <option value="green">Green</option>
                      <option value="blue">Blue</option>
                      <option value="amber">Amber</option>
                      <option value="purple">Purple</option>
                      <option value="red">Red</option>
                      <option value="gray">Gray</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Shape</span>
                    <select id="quick-shape" name="shape">
                      <option value="">Automatic</option>
                      <option value="card">Card</option>
                      <option value="pill">Pill</option>
                      <option value="diamond">Diamond</option>
                      <option value="circle">Circle</option>
                    </select>
                  </label>
                  <label class="field field-wide">
                    <span>Status</span>
                    <select id="quick-status" name="status">
                      <option value="">No status</option>
                      <option value="idea">Idea</option>
                      <option value="active">Active</option>
                      <option value="done">Done</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Category</span>
                    <input id="quick-category" name="category" maxlength="60" placeholder="Behavioral, Android, System design…" autocomplete="off" />
                  </label>
                  <label class="field">
                    <span>Card width</span>
                    <select id="quick-width" name="width">
                      <option value="">Automatic</option>
                      <option value="compact">Compact</option>
                      <option value="normal">Normal</option>
                      <option value="wide">Wide</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Font</span>
                    <select id="quick-font" name="font">
                      <option value="">Automatic</option>
                      <option value="sans">Sans serif</option>
                      <option value="serif">Serif</option>
                      <option value="mono">Monospace</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Font size</span>
                    <input id="quick-font-size" name="fontSize" type="number" min="10" max="48" step="1" placeholder="14" />
                  </label>
                  <label class="field">
                    <span>Font weight</span>
                    <select id="quick-font-weight" name="fontWeight">
                      <option value="">Automatic</option>
                      <option value="regular">Regular</option>
                      <option value="medium">Medium</option>
                      <option value="bold">Bold</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Text alignment</span>
                    <select id="quick-align" name="align">
                      <option value="">Automatic</option>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                </div>
                <button class="button primary field-wide" id="quick-node-submit" type="submit">Add box</button>
              </form>
              <section class="quick-connect" id="quick-connect-section" hidden>
                <div class="section-heading"><strong>Connect boxes</strong><span>Optional label</span></div>
                <form id="quick-connect-form" class="quick-form">
                  <label class="field"><span>From</span><select id="quick-source" required></select></label>
                  <label class="field"><span>To</span><select id="quick-target" required></select></label>
                  <label class="field field-wide"><span>Connection label</span><input id="quick-edge-label" maxlength="80" placeholder="yes, next, depends…" /></label>
                  <button class="button ghost field-wide" type="submit">Connect</button>
                </form>
              </section>
              <p class="panel-hint">Tip: double-click an empty canvas area to open this panel.</p>
            </aside>
            <aside id="template-library" class="side-panel template-library" aria-labelledby="template-library-title" hidden>
              <header class="side-panel-header">
                <div><span class="eyebrow">REAL-WORLD EXAMPLES</span><strong id="template-library-title">Example library</strong></div>
                <button class="icon-button" id="template-library-close" type="button" aria-label="Close example library">×</button>
              </header>
              <div class="template-library-content">
                <p>Choose a working structure to inspect, run, edit, and export as an <code>.mtree</code> file.</p>
                ${this.templateLibraryMarkup()}
              </div>
            </aside>
            <aside id="learn-panel" class="side-panel learn-panel" aria-labelledby="learn-panel-title" hidden>
              <header class="side-panel-header">
                <div><span class="eyebrow">BRANCHSCRIPT BASICS</span><strong id="learn-panel-title">Learn in five moves</strong></div>
                <button class="icon-button" id="learn-panel-close" type="button" aria-label="Close syntax guide">×</button>
              </header>
              <div class="learn-content">
                <section class="lesson"><span>01</span><div><strong>Create a box</strong><code>question intro "Tell me about yourself."</code><p>Every box has a type, unique id, and visible text.</p></div></section>
                <section class="lesson"><span>02</span><div><strong>Branch with two spaces</strong><code>  response concise "Keep it focused."</code><p>Indent a line to place it below the previous box.</p></div></section>
                <section class="lesson"><span>03</span><div><strong>Connect anything</strong><code>connect intro -> concise "choose"</code><p>Use named connections for flows, logic, and neural maps.</p></div></section>
                <section class="lesson"><span>04</span><div><strong>Add useful content</strong><code>  @text "Brief context"<br />  @answer "Prepared answer"<br />  @feature "Follow-up cue"</code><p>Keep the title short and place recall-ready detail inside the box.</p></div></section>
                <section class="lesson"><span>05</span><div><strong>Style and categorize</strong><code>  @category "Behavioral"<br />  @width wide<br />  @color green</code><p>Categories receive a consistent automatic color. Use width to improve long-answer readability and color only when you need a manual override.</p></div></section>
                <section class="lesson data-lesson"><span>DATA</span><div><strong>Show cells and fields</strong><code>array scores "Scores"<br />  @items "8 | 3 | 5 | 1"<br />record user "User"<br />  @fields "id = 42 | name = Ada"</code><p>Use <code>@items</code> for ordered cells and <code>@fields</code> for record rows. Use <code>pointer</code> plus <code>connect</code> to show references.</p></div></section>
                <div class="syntax-grid">
                  <span><code>step</code> process</span><span><code>condition</code> algorithm branch</span><span><code>array</code> data cells</span><span><code>#</code> comment</span>
                </div>
                <button class="button primary" type="button" id="guide-open-builder">Try the visual builder</button>
              </div>
            </aside>
            <div class="canvas-status">
              <span id="save-indicator" class="status-dot"></span>
              <span id="status-text">Loading…</span>
            </div>
          </section>
        </section>
        <aside id="account-panel" class="account-panel" aria-labelledby="account-panel-title" hidden>
          <div class="account-scrim" data-account-close></div>
          <section class="account-dialog">
            <header class="side-panel-header">
              <div><span class="eyebrow">BRANCHSCRIPT CLOUD</span><strong id="account-panel-title">Account & diagrams</strong></div>
              <button class="icon-button" id="account-panel-close" type="button" aria-label="Close account panel">×</button>
            </header>
            <div class="account-content">
              <section id="signed-out-view" class="auth-view">
                <div class="auth-tabs" role="tablist" aria-label="Account action">
                  <button class="auth-tab" type="button" data-auth-tab="login" aria-selected="true">Sign in</button>
                  <button class="auth-tab" type="button" data-auth-tab="register" aria-selected="false">Create account</button>
                  <button class="auth-tab" type="button" data-auth-tab="verify" aria-selected="false">Verify email</button>
                </div>
                <form id="login-form" class="auth-form" data-auth-form="login">
                  <h2>Continue your diagrams</h2>
                  <p>Your session stays in a secure browser cookie.</p>
                  <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
                  <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" maxlength="72" required /></label>
                  <button class="button primary" type="submit">Sign in</button>
                </form>
                <form id="register-form" class="auth-form" data-auth-form="register" hidden>
                  <h2>Create a BranchScript account</h2>
                  <p>Save diagrams privately and continue on another device.</p>
                  <label class="field"><span>Name</span><input name="full_name" autocomplete="name" maxlength="100" /></label>
                  <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
                  <label class="field"><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="15" maxlength="72" required /><small>15–72 characters</small></label>
                  <button class="button primary" type="submit">Create account</button>
                </form>
                <form id="verify-form" class="auth-form" data-auth-form="verify" hidden>
                  <h2>Verify your email</h2>
                  <p>Enter the six-digit code sent by Neuralith AI Studio.</p>
                  <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
                  <label class="field"><span>Verification code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label>
                  <button class="button primary" type="submit">Verify email</button>
                  <button class="button ghost" id="resend-verification-button" type="button">Send another code</button>
                </form>
                <p id="auth-message" class="auth-message" role="status"></p>
              </section>
              <section id="signed-in-view" class="cloud-library" hidden>
                <div class="account-summary">
                  <div><span class="eyebrow">SIGNED IN</span><strong id="account-email"></strong></div>
                  <button class="button ghost compact" id="logout-button" type="button">Sign out</button>
                </div>
                <div class="cloud-library-heading"><div><h2>Your cloud diagrams</h2><p>Up to 25 privately saved diagrams.</p></div><button class="button primary compact" id="library-save-button" type="button">Save current</button></div>
                <div id="cloud-diagram-list" class="cloud-diagram-list"><p class="empty-message">Loading diagrams…</p></div>
              </section>
            </div>
          </section>
        </aside>
        <aside id="confirmation-panel" class="confirmation-panel" hidden>
          <div class="confirmation-scrim" data-confirm-cancel></div>
          <section class="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
            <span class="confirmation-icon" aria-hidden="true">!</span>
            <div class="confirmation-copy">
              <span class="eyebrow">CONFIRM CHANGE</span>
              <strong id="confirmation-title">Replace current diagram?</strong>
              <p id="confirmation-message"></p>
            </div>
            <footer class="confirmation-actions">
              <button class="button ghost" id="confirmation-cancel" type="button">Cancel</button>
              <button class="button primary" id="confirmation-accept" type="button">Replace</button>
            </footer>
          </section>
        </aside>
      </main>
    `;
  }

  private presetCard(view: DiagramView, title: string, description: string): string {
    const motif = {
      tree: '<span class="motif-node root"></span><span class="motif-node left"></span><span class="motif-node right"></span>',
      flow: '<span class="motif-node one"></span><span class="motif-node two"></span><span class="motif-node three"></span>',
      neural: '<span class="motif-node input-a"></span><span class="motif-node input-b"></span><span class="motif-node hidden-a"></span><span class="motif-node hidden-b"></span><span class="motif-node output"></span>',
      logic: '<span class="motif-node start"></span><span class="motif-node diamond"></span><span class="motif-node yes"></span><span class="motif-node no"></span>',
      algorithm: '<span class="motif-node one"></span><span class="motif-node diamond"></span><span class="motif-node three"></span>',
      data: '<span class="motif-node root"></span><span class="motif-node left"></span><span class="motif-node right"></span>',
    }[view];
    return `
      <button class="preset-card" type="button" data-preset="${view}" aria-label="${t("Load {name} template", { name: t(title) })}">
        <span class="preset-visual ${view}" aria-hidden="true">${motif}</span>
        <span class="preset-copy"><strong>${title}</strong><small>${description}</small></span>
      </button>
    `;
  }

  private templateLibraryMarkup(): string {
    const groups: Array<{ view: DiagramView; title: string; description: string }> = [
      { view: "data", title: "Data structures", description: "Memory, indexing, queues, caches, and references" },
      { view: "algorithm", title: "Algorithms", description: "Search, sorting, graph traversal, and rate limiting" },
      { view: "logic", title: "Logic systems", description: "Calculator, authorization, checkout, and answer routing" },
      { view: "neural", title: "Neural networks", description: "Classification, anomaly detection, and signal aggregation" },
    ];
    return groups
      .map(({ view, title, description }) => {
        const presets = presetsForView(view);
        return `
          <section class="template-group" data-template-group="${view}">
            <header><div><strong>${title}</strong><span>${description}</span></div><small>${presets.length} examples</small></header>
            <div class="template-example-list">
              ${presets.map((preset) => `
                <button class="template-example-card" type="button" data-example-preset="${preset.id}" data-example-view="${preset.view}">
                  <span class="template-example-kind">${preset.shortTitle}</span>
                  <strong>${preset.title}</strong>
                  <span>${preset.description}</span>
                  <code>${preset.filename}</code>
                </button>
              `).join("")}
            </div>
          </section>
        `;
      })
      .join("");
  }

  private shapePaletteMarkup(): string {
    return this.shapePaletteForCurrentView()
      .map(
        (preset) => `
          <button class="shape-palette-item" type="button" data-shape-preset="${preset.shape}" aria-label="${t("Drag {name} shape", { name: t(preset.name) })}" aria-pressed="false">
            <span class="shape-palette-preview ${preset.shape}" aria-hidden="true"></span>
            <span><strong>${preset.name}</strong><small>${preset.shapeName}</small></span>
          </button>
        `,
      )
      .join("");
  }

  private shapePaletteForCurrentView(): readonly ShapePalettePreset[] {
    const view = this.store.get().document?.view;
    return view ? shapePalettes[view] ?? defaultShapePalette : defaultShapePalette;
  }

  private refreshShapePalette(view: DiagramView): void {
    const presets = shapePalettes[view] ?? defaultShapePalette;
    const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("[data-shape-preset]")];
    presets.forEach((preset, index) => {
      const button = buttons[index];
      if (!button) return;
      button.dataset.shapePreset = preset.shape;
      button.setAttribute("aria-label", t("Drag {name} shape", { name: t(preset.name) }));
      const preview = button.querySelector<HTMLElement>(".shape-palette-preview");
      if (preview) preview.className = `shape-palette-preview ${preset.shape}`;
      const name = button.querySelector("strong");
      if (name) name.textContent = t(preset.name);
      const shapeName = button.querySelector("small");
      if (shapeName) shapeName.textContent = t(preset.shapeName);
    });
  }

  private bindControls(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-mobile-view-button]")) {
      button.addEventListener("click", () => this.setMobileView(button.dataset.mobileViewButton as "source" | "canvas"));
    }
    for (const card of this.root.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
      card.addEventListener("click", () => void this.loadPreset(card.dataset.preset ?? ""));
    }
    this.requireElement("blank-project-button").addEventListener("click", () => void this.startBlankProject());
    this.requireElement("confirmation-cancel").addEventListener("click", () => this.resolveConfirmation(false));
    this.requireElement("confirmation-accept").addEventListener("click", () => this.resolveConfirmation(true));
    this.root.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => this.resolveConfirmation(false));
    this.requireElement("account-button").addEventListener("click", () => this.openAccountPanel());
    this.requireElement("account-panel-close").addEventListener("click", () => this.closeAccountPanel());
    this.root.querySelector("[data-account-close]")?.addEventListener("click", () => this.closeAccountPanel());
    this.requireElement("cloud-save-button").addEventListener("click", () => void this.saveToCloud());
    this.requireElement("library-save-button").addEventListener("click", () => void this.saveToCloud());
    this.requireElement("logout-button").addEventListener("click", () => void this.signOut());
    for (const tab of this.root.querySelectorAll<HTMLButtonElement>("[data-auth-tab]")) {
      tab.addEventListener("click", () => this.setAuthTab(tab.dataset.authTab as "login" | "register" | "verify"));
    }
    this.requireElement("login-form").addEventListener("submit", (event) => void this.signIn(event));
    this.requireElement("register-form").addEventListener("submit", (event) => void this.createAccount(event));
    this.requireElement("verify-form").addEventListener("submit", (event) => void this.verifyAccount(event));
    this.requireElement("resend-verification-button").addEventListener("click", () => void this.resendVerificationCode());
    this.requireElement("import-button").addEventListener("click", () => this.fileInput().click());
    this.fileInput().addEventListener("change", () => void this.importFile());
    this.requireElement("export-source-button").addEventListener("click", () => this.exportSource());
    this.requireElement("export-project-button").addEventListener("click", () => this.exportProject());
    this.requireElement("language-select").addEventListener("change", (event) => {
      setLocale((event.currentTarget as HTMLSelectElement).value as Locale);
      void this.persist().finally(() => window.location.reload());
    });
    this.requireElement("theme-button").addEventListener("click", () => this.toggleTheme());
    this.requireElement("guide-button").addEventListener("click", () => this.openLearnPanel());
    this.requireElement("editor-guide-button").addEventListener("click", () => this.openLearnPanel());
    this.requireElement("learn-panel-close").addEventListener("click", () => this.closeLearnPanel());
    this.requireElement("template-library-button").addEventListener("click", () => this.openTemplateLibrary());
    this.requireElement("template-library-close").addEventListener("click", () => this.closeTemplateLibrary());
    for (const example of this.root.querySelectorAll<HTMLButtonElement>("[data-example-preset]")) {
      example.addEventListener("click", () => void this.loadPreset(example.dataset.examplePreset ?? ""));
    }
    this.requireElement("guide-open-builder").addEventListener("click", () => {
      this.closeLearnPanel();
      this.openQuickBuilder();
    });
    this.requireElement("add-node-button").addEventListener("click", () => this.openQuickBuilder());
    this.requireElement("quick-builder-close").addEventListener("click", () => this.closeQuickBuilder(true, true));
    this.requireElement("shape-placement-cancel").addEventListener("click", () => this.setPendingShape(null));
    this.bindShapePalette();
    this.requireElement("quick-advanced-toggle").addEventListener("click", () => {
      const advanced = this.requireElement("quick-advanced-settings");
      this.setQuickAdvanced(advanced.hidden === true);
    });
    this.requireElement("quick-node-form").addEventListener("submit", (event) => this.addQuickNode(event));
    this.requireElement("quick-connect-form").addEventListener("submit", (event) => this.addQuickConnection(event));
    this.bindQuickEditorSync();
    this.requireElement("editor-undo").addEventListener("click", () => this.editor?.undo());
    this.requireElement("editor-redo").addEventListener("click", () => this.editor?.redo());
    this.requireElement("hide-source-button").addEventListener("click", () => this.setSourcePanelCollapsed(true));
    this.requireElement("show-source-button").addEventListener("click", () => this.setSourcePanelCollapsed(false));
    this.bindSourcePanelResizer();
    this.requireElement("canvas-undo").addEventListener("click", () => this.canvas?.undo());
    this.requireElement("canvas-redo").addEventListener("click", () => this.canvas?.redo());
    this.requireElement("fit-button").addEventListener("click", () => this.canvas?.fit());
    this.requireElement("fullscreen-button").addEventListener("click", () => void this.toggleCanvasFullscreen());
    document.addEventListener("fullscreenchange", () => this.updateFullscreenControl());
    this.requireElement("layout-button").addEventListener("click", () => this.autoLayout());
    this.requireElement("direction-button").addEventListener("click", () => this.toggleDirection());
    this.requireElement("global-font-scale").addEventListener("change", (event) => {
      this.setGlobalFontScale(Number((event.currentTarget as HTMLSelectElement).value));
    });
    this.requireElement("live-run-button").addEventListener("click", () => this.toggleRunner());
    this.requireElement("runner-close").addEventListener("click", () => this.closeRunner());
    this.requireElement("runner-back").addEventListener("click", () => this.runnerBack());
    this.requireElement("runner-reset").addEventListener("click", () => this.runnerReset());
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-context-action]")) {
      button.addEventListener("click", () => this.runCanvasContextAction(button.dataset.contextAction ?? ""));
    }
    const nodeSearch = this.requireElement("node-search") as HTMLInputElement;
    nodeSearch.addEventListener("input", (event) => {
      const search = (event.currentTarget as HTMLInputElement).value;
      this.store.update({ search });
      this.searchResultIndex = -1;
      this.searchResultQuery = search;
      this.canvas?.applySearch(search);
      this.updateSearchStatus(search);
    });
    nodeSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.navigateSearch(event.shiftKey ? -1 : 1);
    });
    this.root.addEventListener("selectstart", (event) => {
      if (!this.isTextSelectionTarget(event.target)) event.preventDefault();
    });
    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && !this.isTextSelectionTarget(event.target)) {
        event.preventDefault();
      }
      if (event.key === "Escape") {
        if (this.confirmationResolver) {
          event.preventDefault();
          this.resolveConfirmation(false);
          return;
        }
        this.closeCanvasContextMenu();
        this.closeQuickBuilder();
        this.closeLearnPanel();
        this.closeTemplateLibrary();
        this.closeAccountPanel();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.openQuickBuilder();
      }
    });
    window.addEventListener("pointerdown", (event) => {
      const menu = this.requireElement("canvas-context-menu");
      if (!menu.hidden && event.target instanceof Node && !menu.contains(event.target)) this.closeCanvasContextMenu();
    });
    window.addEventListener("resize", () => {
      this.closeCanvasContextMenu();
      this.applySourcePanelLayout();
    });
  }

  private async toggleCanvasFullscreen(): Promise<void> {
    const panel = this.root.querySelector<HTMLElement>(".canvas-panel");
    if (!panel) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await panel.requestFullscreen();
    } catch {
      this.updateStatus(t("Fullscreen is not available."), "error");
    }
  }

  private updateFullscreenControl(): void {
    const button = this.requireElement("fullscreen-button") as HTMLButtonElement;
    const fullscreen = document.fullscreenElement === this.root.querySelector(".canvas-panel");
    const label = t(fullscreen ? "Exit full screen" : "Full screen");
    button.setAttribute("aria-label", label);
    const labelElement = button.querySelector(".fullscreen-label");
    if (labelElement) labelElement.textContent = label;
  }

  private isTextSelectionTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(".cm-editor, input, textarea, [contenteditable='true']"));
  }

  private updateSearchStatus(query: string, activeIndex: number | null = null): void {
    const output = this.requireElement("node-search-status");
    const matches = this.canvas?.searchMatches(query) ?? [];
    if (!query.trim()) {
      output.textContent = "";
      output.removeAttribute("title");
      return;
    }
    output.textContent = activeIndex === null || matches.length === 0
      ? String(matches.length)
      : `${activeIndex + 1}/${matches.length}`;
    output.title = t(matches.length === 1 ? "1 search result" : "{count} search results", { count: matches.length });
  }

  private navigateSearch(direction: 1 | -1): void {
    const input = this.requireElement("node-search") as HTMLInputElement;
    const query = input.value.trim();
    if (!query) return;
    const matches = this.canvas?.searchMatches(query) ?? [];
    if (matches.length === 0) {
      this.searchResultIndex = -1;
      this.canvas?.applySearch(query);
      this.updateSearchStatus(query);
      this.updateStatus(t("No search results"), "error");
      return;
    }

    if (this.searchResultQuery !== query || this.searchResultIndex < 0) {
      this.searchResultIndex = direction === 1 ? 0 : matches.length - 1;
    } else {
      this.searchResultIndex = (this.searchResultIndex + direction + matches.length) % matches.length;
    }
    this.searchResultQuery = query;
    const nodeId = matches[this.searchResultIndex];
    if (!nodeId) return;
    this.canvas?.applySearch(query, nodeId);
    this.canvas?.focusSearchResult(nodeId);
    this.updateSearchStatus(query, this.searchResultIndex);
    this.updateStatus(t("Search result {current} of {count}", { current: this.searchResultIndex + 1, count: matches.length }), "ok");
  }

  private onSourceChange(source: string): void {
    // Source edits can replace the node currently shown in the form. Keeping
    // that form open would allow stale attributes to be written back later.
    if (this.editingNodeId && !this.syncingQuickEditor) this.closeQuickBuilder(false);
    this.store.update({ source });
    this.updateStatus("Compiling…", "working");
    if (this.compileTimer !== null) window.clearTimeout(this.compileTimer);
    this.compileTimer = window.setTimeout(() => {
      this.compileTimer = null;
      this.compile(false);
    }, 160);
    this.scheduleSave();
  }

  private compileImmediately(fitView: boolean): void {
    if (this.compileTimer !== null) window.clearTimeout(this.compileTimer);
    this.compileTimer = null;
    this.compile(fitView);
  }

  private compile(initial: boolean): void {
    const result = compileMindTree(this.store.get().source);
    this.store.update({ diagnostics: result.diagnostics });
    this.editor?.setDiagnostics(result.diagnostics);
    this.renderDiagnostics(result.diagnostics);

    if (!result.document) {
      const count = result.diagnostics.length;
      this.updateStatus(t(count === 1 ? "{count} issue" : "{count} issues", { count }), "error");
      return;
    }

    this.store.update({ document: result.document });
    (this.requireElement("global-font-scale") as HTMLSelectElement).value = String(result.document.fontScale);
    this.updateViewControls(result.document.view);
    this.refreshShapePalette(result.document.view);
    this.refreshQuickOptions(result.document);
    const positions = this.canvas?.render(
      result.document,
      this.store.get().direction,
      this.store.get().positions,
      false,
    );
    if (positions) this.store.update({ positions });
    this.canvas?.applySearch(this.store.get().search);
    this.updateSearchStatus(this.store.get().search);
    if (this.runnerOpen) {
      this.runPath = [];
      this.canvas?.clearHighlight();
      this.renderRunner();
    }
    this.updateStatus(t("{count} nodes", { count: result.document.nodes.length }), "ok");
    if (initial) window.setTimeout(() => this.canvas?.fit(), 80);
    this.scheduleSave();
  }

  private bindShapePalette(): void {
    const canvasElement = this.requireElement("graph-canvas");
    const quickBuilder = this.requireElement("quick-builder");
    let pointerDrag: {
      pointerId: number;
      pointerType: string;
      shape: NodeShape;
      button: HTMLButtonElement;
      startX: number;
      startY: number;
      active: boolean;
      ghost: HTMLElement | null;
    } | null = null;

    const pointInsideCanvas = (clientX: number, clientY: number): boolean => {
      const bounds = canvasElement.getBoundingClientRect();
      if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return false;
      const target = document.elementFromPoint(clientX, clientY);
      return target === canvasElement || (target instanceof Element && canvasElement.contains(target));
    };

    const createGhost = (shape: NodeShape): HTMLElement => {
      const preset = this.shapePreset(shape);
      const ghost = document.createElement("div");
      ghost.className = "shape-drag-ghost";
      ghost.setAttribute("aria-hidden", "true");
      const preview = document.createElement("span");
      preview.className = `shape-palette-preview ${shape}`;
      const label = document.createElement("strong");
      label.textContent = preset ? t(preset.name) : shape;
      ghost.append(preview, label);
      document.body.append(ghost);
      return ghost;
    };

    const finishPointerDrag = (event: PointerEvent, cancelled = false): void => {
      const drag = pointerDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dropped = drag.active && !cancelled && pointInsideCanvas(event.clientX, event.clientY);
      if (drag.active) {
        event.preventDefault();
        event.stopPropagation();
        drag.button.dataset.suppressClick = "true";
        window.setTimeout(() => delete drag.button.dataset.suppressClick, 0);
        if (dropped) {
          const position = this.canvas?.clientPointToGraph(event.clientX, event.clientY);
          if (position) this.addShapeAt(drag.shape, position);
        }
      }
      try {
        if (drag.button.hasPointerCapture(event.pointerId)) drag.button.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may already have been released by the browser.
      }
      drag.ghost?.remove();
      delete drag.button.dataset.dragging;
      canvasElement.classList.remove("shape-drop-target");
      quickBuilder.classList.remove("shape-pointer-dragging");
      pointerDrag = null;
      if (dropped && drag.pointerType === "touch" && window.matchMedia("(max-width: 560px)").matches) {
        this.closeQuickBuilder(false);
      }
    };

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-shape-preset]")) {
      button.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        const shape = button.dataset.shapePreset as NodeShape;
        if (!this.shapePreset(shape)) return;
        pointerDrag = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          shape,
          button,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
          ghost: null,
        };
        try {
          button.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic pointer events do not always provide capture.
        }
      });
      button.addEventListener("pointermove", (event) => {
        const drag = pointerDrag;
        if (!drag || drag.pointerId !== event.pointerId || drag.button !== button) return;
        if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
        event.preventDefault();
        if (!drag.active) {
          drag.active = true;
          drag.ghost = createGhost(drag.shape);
          this.setPendingShape(null);
          button.dataset.dragging = "true";
          if (drag.pointerType === "touch" && window.matchMedia("(max-width: 560px)").matches) {
            quickBuilder.classList.add("shape-pointer-dragging");
          }
        }
        if (drag.ghost) {
          drag.ghost.style.left = `${event.clientX}px`;
          drag.ghost.style.top = `${event.clientY}px`;
        }
        canvasElement.classList.toggle("shape-drop-target", pointInsideCanvas(event.clientX, event.clientY));
      });
      button.addEventListener("pointerup", (event) => finishPointerDrag(event));
      button.addEventListener("pointercancel", (event) => finishPointerDrag(event, true));
      button.addEventListener("click", () => {
        if (button.dataset.suppressClick === "true") return;
        const shape = button.dataset.shapePreset as NodeShape;
        this.setPendingShape(this.pendingShape === shape ? null : shape);
        if (this.pendingShape && window.matchMedia("(max-width: 560px)").matches) this.closeQuickBuilder(false);
      });
    }
    window.addEventListener("pointerup", (event) => finishPointerDrag(event), { capture: true });
    window.addEventListener("pointercancel", (event) => finishPointerDrag(event, true), { capture: true });
  }

  private shapePreset(shape: NodeShape): ShapePalettePreset | undefined {
    return this.shapePaletteForCurrentView().find((preset) => preset.shape === shape);
  }

  private setPendingShape(shape: NodeShape | null): void {
    this.pendingShape = shape;
    const preset = shape ? this.shapePreset(shape) : null;
    const cue = this.requireElement("shape-placement-cue");
    cue.hidden = !preset;
    this.requireElement("graph-canvas").classList.toggle("shape-placement-active", Boolean(preset));
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-shape-preset]")) {
      button.setAttribute("aria-pressed", String(button.dataset.shapePreset === shape));
    }
    if (preset) {
      this.requireElement("shape-placement-label").textContent = t("Tap canvas to place {name}", {
        name: t(preset.name),
      });
    }
  }

  private placePendingShape(position: Point): void {
    if (!this.pendingShape) return;
    const shape = this.pendingShape;
    this.setPendingShape(null);
    this.addShapeAt(shape, position);
  }

  private addShapeAt(shape: NodeShape, center: Point): void {
    const preset = this.shapePreset(shape);
    if (!preset) return;
    const label = t(preset.label);
    const id = this.uniqueNodeId(label);
    const size = {
      card: { width: 292, height: 116 },
      pill: { width: 212, height: 76 },
      diamond: { width: 230, height: 144 },
      circle: { width: 126, height: 126 },
    }[shape];
    const position = {
      x: Math.round(center.x - size.width / 2),
      y: Math.round(center.y - size.height / 2),
    };
    this.store.update({ positions: { ...this.store.get().positions, [id]: position } });
    this.appendScript([
      `${preset.kind} ${id} ${JSON.stringify(label)}`,
      ...(preset.keepNativeShape ? [] : [`  @shape ${shape}`]),
    ]);
    this.updateStatus(t("Added {name}", { name: label }), "working");
  }

  private openQuickBuilder(parentId: string | null = null): void {
    this.editingNodeId = null;
    this.setMobileView("canvas");
    this.closeCanvasContextMenu();
    this.closeLearnPanel();
    this.closeTemplateLibrary();
    (this.requireElement("quick-node-form") as HTMLFormElement).reset();
    this.setQuickAdvanced(false);
    this.requireElement("quick-builder-title").textContent = t("Add without scripting");
    this.requireElement("quick-node-submit").textContent = t("Add box");
    this.requireElement("quick-parent-field").hidden = false;
    this.requireElement("shape-palette").hidden = false;
    const panel = this.requireElement("quick-builder");
    panel.hidden = false;
    const graphDocument = this.store.get().document;
    if (graphDocument) {
      this.refreshQuickOptions(graphDocument);
      if (parentId && graphDocument.nodes.some((node) => node.id === parentId)) {
        (this.requireElement("quick-parent") as HTMLSelectElement).value = parentId;
      }
    }
    window.setTimeout(() => this.root.querySelector<HTMLInputElement>("#quick-label")?.focus(), 0);
  }

  private openNodeEditor(nodeId: string): void {
    const graphDocument = this.store.get().document;
    const node = graphDocument?.nodes.find((candidate) => candidate.id === nodeId);
    if (!graphDocument || !node) return;
    this.setPendingShape(null);
    this.editingNodeId = node.id;
    this.setMobileView("canvas");
    this.closeCanvasContextMenu();
    this.closeLearnPanel();
    this.closeTemplateLibrary();
    this.refreshQuickOptions(graphDocument);
    this.requireElement("quick-builder-title").textContent = t("Edit box");
    this.requireElement("quick-node-submit").textContent = t("Done");
    this.requireElement("quick-parent-field").hidden = true;
    this.requireElement("shape-palette").hidden = true;
    this.requireElement("quick-connect-section").hidden = true;
    (this.requireElement("quick-label") as HTMLInputElement).value = node.label;
    (this.requireElement("quick-text") as HTMLTextAreaElement).value = node.text ?? "";
    (this.requireElement("quick-answer") as HTMLTextAreaElement).value = node.answer ?? "";
    (this.requireElement("quick-feature") as HTMLInputElement).value = node.feature ?? "";
    (this.requireElement("quick-kind") as HTMLSelectElement).value = node.kind;
    (this.requireElement("quick-color") as HTMLSelectElement).value = node.color ?? "";
    (this.requireElement("quick-shape") as HTMLSelectElement).value = node.shape ?? "";
    (this.requireElement("quick-status") as HTMLSelectElement).value = node.status ?? "";
    (this.requireElement("quick-category") as HTMLInputElement).value = node.category ?? "";
    (this.requireElement("quick-width") as HTMLSelectElement).value = node.width ?? "";
    (this.requireElement("quick-font") as HTMLSelectElement).value = node.fontFamily ?? "";
    (this.requireElement("quick-font-size") as HTMLInputElement).value = node.fontSize ? String(node.fontSize) : "";
    (this.requireElement("quick-font-weight") as HTMLSelectElement).value = node.fontWeight ?? "";
    (this.requireElement("quick-align") as HTMLSelectElement).value = node.textAlign ?? "";
    this.setQuickAdvanced(Boolean(node.answer || node.feature || node.color || node.shape || node.status || node.category || node.width || node.fontFamily || node.fontSize || node.fontWeight || node.textAlign));
    this.requireElement("quick-builder").hidden = false;
    window.setTimeout(() => (this.requireElement("quick-label") as HTMLInputElement).focus(), 0);
  }

  private openCanvasContextMenu(request: { clientX: number; clientY: number; nodeId: string | null }): void {
    const menu = this.requireElement("canvas-context-menu");
    const panel = menu.closest<HTMLElement>(".canvas-panel");
    if (!panel) return;
    this.contextNodeId = request.nodeId;
    for (const item of menu.querySelectorAll<HTMLElement>("[data-node-context]")) item.hidden = !request.nodeId;
    menu.hidden = false;
    const panelBounds = panel.getBoundingClientRect();
    const left = Math.max(8, Math.min(request.clientX - panelBounds.left, panel.clientWidth - menu.offsetWidth - 8));
    const top = Math.max(8, Math.min(request.clientY - panelBounds.top, panel.clientHeight - menu.offsetHeight - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.querySelector<HTMLButtonElement>("button:not([hidden])")?.focus();
  }

  private closeCanvasContextMenu(): void {
    const menu = this.requireElement("canvas-context-menu");
    menu.hidden = true;
    this.contextNodeId = null;
  }

  private runCanvasContextAction(action: string): void {
    const nodeId = this.contextNodeId;
    this.closeCanvasContextMenu();
    if (action === "add") this.openQuickBuilder();
    if (action === "add-connected") this.openQuickBuilder(nodeId);
    if (action === "layout") this.autoLayout();
    if (action === "fit") this.canvas?.fit();
    if (action === "source" && nodeId) {
      const node = this.store.get().document?.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      this.setSourcePanelCollapsed(false);
      this.onNodesSelected([nodeId]);
      this.setMobileView("source");
      window.setTimeout(() => this.editor?.reveal(node.source.from.offset, node.source.to.offset), 0);
    }
  }

  private closeQuickBuilder(clearPlacement = true, persistPendingEdit = false): void {
    if (persistPendingEdit && this.editingNodeId) this.flushQuickEditorSync();
    if (this.quickEditorTimer !== null) {
      window.clearTimeout(this.quickEditorTimer);
      this.quickEditorTimer = null;
    }
    this.requireElement("quick-builder").hidden = true;
    this.editingNodeId = null;
    if (clearPlacement) this.setPendingShape(null);
  }

  private setQuickAdvanced(open: boolean): void {
    const settings = this.requireElement("quick-advanced-settings");
    const toggle = this.requireElement("quick-advanced-toggle");
    settings.hidden = !open;
    if (!this.editingNodeId) this.requireElement("quick-connect-section").hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = t(open ? "Hide extra options" : "Show more options");
  }

  private openLearnPanel(): void {
    this.setMobileView("canvas");
    this.closeQuickBuilder();
    this.closeTemplateLibrary();
    this.requireElement("learn-panel").hidden = false;
  }

  private closeLearnPanel(): void {
    this.requireElement("learn-panel").hidden = true;
  }

  private openTemplateLibrary(): void {
    this.setMobileView("canvas");
    this.closeQuickBuilder();
    this.closeLearnPanel();
    this.requireElement("template-library").hidden = false;
    this.root.querySelector<HTMLButtonElement>("[data-example-preset]")?.focus();
  }

  private closeTemplateLibrary(): void {
    this.requireElement("template-library").hidden = true;
  }

  private openAccountPanel(): void {
    this.requireElement("account-panel").hidden = false;
    if (this.user) void this.refreshCloudLibrary();
  }

  private closeAccountPanel(): void {
    this.requireElement("account-panel").hidden = true;
  }

  private setAuthTab(tab: "login" | "register" | "verify"): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-auth-tab]")) {
      button.setAttribute("aria-selected", String(button.dataset.authTab === tab));
    }
    for (const form of this.root.querySelectorAll<HTMLFormElement>("[data-auth-form]")) {
      form.hidden = form.dataset.authForm !== tab;
    }
    this.setAuthMessage("");
  }

  private setMobileView(view: "source" | "canvas"): void {
    const workspace = this.root.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    workspace.dataset.mobileView = view;
    for (const button of workspace.querySelectorAll<HTMLButtonElement>("[data-mobile-view-button]")) {
      const active = button.dataset.mobileViewButton === view;
      button.setAttribute("aria-pressed", String(active));
    }
    if (view === "canvas") window.setTimeout(() => this.canvas?.fit(), 80);
  }

  private restoreSourcePanelLayout(): void {
    try {
      const saved = JSON.parse(window.localStorage.getItem(sourcePanelLayoutKey) ?? "null") as Partial<SourcePanelLayout> | null;
      if (saved && typeof saved.ratio === "number" && Number.isFinite(saved.ratio)) {
        this.sourcePanelRatio = Math.min(0.7, Math.max(0.25, saved.ratio));
      }
      if (saved && typeof saved.collapsed === "boolean") this.sourcePanelCollapsed = saved.collapsed;
    } catch {
      this.sourcePanelRatio = 0.39;
      this.sourcePanelCollapsed = false;
    }
  }

  private persistSourcePanelLayout(): void {
    const layout: SourcePanelLayout = { ratio: this.sourcePanelRatio, collapsed: this.sourcePanelCollapsed };
    try {
      window.localStorage.setItem(sourcePanelLayoutKey, JSON.stringify(layout));
    } catch {
      return;
    }
  }

  private sourcePanelRatioBounds(workspace: HTMLElement): { min: number; max: number } {
    const width = Math.max(workspace.clientWidth, 1);
    const min = Math.min(0.42, 280 / width);
    const max = Math.max(min, Math.min(0.7, (width - 430) / width));
    return { min, max };
  }

  private applySourcePanelLayout(persist = false): void {
    const workspace = this.root.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    const desktop = window.matchMedia("(min-width: 901px)").matches;
    const bounds = desktop ? this.sourcePanelRatioBounds(workspace) : { min: 0.25, max: 0.7 };
    if (desktop) {
      this.sourcePanelRatio = Math.min(bounds.max, Math.max(bounds.min, this.sourcePanelRatio));
    }
    workspace.style.setProperty("--source-panel-width", `${this.sourcePanelRatio * 100}%`);
    workspace.dataset.sourceCollapsed = String(this.sourcePanelCollapsed);
    const showButton = this.requireElement("show-source-button") as HTMLButtonElement;
    const resizer = this.requireElement("workspace-resizer");
    showButton.hidden = !this.sourcePanelCollapsed;
    showButton.setAttribute("aria-expanded", String(!this.sourcePanelCollapsed));
    resizer.setAttribute("aria-valuemin", String(Math.round(bounds.min * 100)));
    resizer.setAttribute("aria-valuemax", String(Math.round(bounds.max * 100)));
    resizer.setAttribute("aria-valuenow", String(Math.round(this.sourcePanelRatio * 100)));
    if (persist) this.persistSourcePanelLayout();
  }

  private setSourcePanelCollapsed(collapsed: boolean): void {
    this.sourcePanelCollapsed = collapsed;
    this.applySourcePanelLayout(true);
    if (!collapsed) window.setTimeout(() => this.editor?.focus(), 80);
  }

  private bindSourcePanelResizer(): void {
    const resizer = this.requireElement("workspace-resizer");
    resizer.addEventListener("pointerdown", (event) => {
      if (!window.matchMedia("(min-width: 901px)").matches || this.sourcePanelCollapsed) return;
      this.sourcePanelPointerId = event.pointerId;
      resizer.setPointerCapture(event.pointerId);
      this.root.querySelector<HTMLElement>(".workspace")?.setAttribute("data-resizing", "true");
      event.preventDefault();
    });
    resizer.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.sourcePanelPointerId) return;
      const workspace = this.root.querySelector<HTMLElement>(".workspace");
      if (!workspace) return;
      const bounds = workspace.getBoundingClientRect();
      this.sourcePanelRatio = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
      this.applySourcePanelLayout();
    });
    const finishResize = (event: PointerEvent) => {
      if (event.pointerId !== this.sourcePanelPointerId) return;
      if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
      this.sourcePanelPointerId = null;
      this.root.querySelector<HTMLElement>(".workspace")?.removeAttribute("data-resizing");
      this.persistSourcePanelLayout();
    };
    resizer.addEventListener("pointerup", finishResize);
    resizer.addEventListener("pointercancel", finishResize);
    resizer.addEventListener("dblclick", () => {
      this.sourcePanelRatio = 0.39;
      this.applySourcePanelLayout(true);
    });
    resizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
      const workspace = this.root.querySelector<HTMLElement>(".workspace");
      if (!workspace) return;
      const bounds = this.sourcePanelRatioBounds(workspace);
      if (event.key === "ArrowLeft") this.sourcePanelRatio -= 0.025;
      if (event.key === "ArrowRight") this.sourcePanelRatio += 0.025;
      if (event.key === "Home") this.sourcePanelRatio = bounds.min;
      if (event.key === "End") this.sourcePanelRatio = bounds.max;
      this.applySourcePanelLayout(true);
      event.preventDefault();
    });
  }

  private refreshQuickOptions(graphDocument: GraphDocument): void {
    const selected = this.store.get().selectedNodeId;
    const targets = ["quick-parent", "quick-source", "quick-target"] as const;
    for (const id of targets) {
      const select = this.requireElement(id) as HTMLSelectElement;
      const previous = select.value;
      select.replaceChildren();
      if (id === "quick-parent") {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = t("No connection");
        select.append(empty);
      }
      for (const node of graphDocument.nodes) {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = `${node.label} · ${node.kind}`;
        select.append(option);
      }
      const preferred = previous || (id !== "quick-target" ? selected : null);
      if (preferred && graphDocument.nodes.some((node) => node.id === preferred)) select.value = preferred;
    }
  }

  private bindQuickEditorSync(): void {
    const form = this.requireElement("quick-node-form");
    for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
      control.addEventListener("input", () => this.scheduleQuickEditorSync());
      control.addEventListener("change", () => this.scheduleQuickEditorSync());
    }
  }

  private scheduleQuickEditorSync(): void {
    if (!this.editingNodeId) return;
    if (this.quickEditorTimer !== null) window.clearTimeout(this.quickEditorTimer);
    this.quickEditorTimer = window.setTimeout(() => {
      this.quickEditorTimer = null;
      this.flushQuickEditorSync();
    }, 180);
  }

  private flushQuickEditorSync(): void {
    const nodeId = this.editingNodeId;
    if (!nodeId) return;
    if (this.quickEditorTimer !== null) {
      window.clearTimeout(this.quickEditorTimer);
      this.quickEditorTimer = null;
    }
    this.saveQuickNodeEdit(nodeId, { close: false, announce: false });
  }

  private addQuickNode(event: Event): void {
    event.preventDefault();
    if (this.editingNodeId) {
      this.flushQuickEditorSync();
      this.closeQuickBuilder();
      return;
    }
    const labelInput = this.requireElement("quick-label") as HTMLInputElement;
    const label = labelInput.value.trim();
    if (!label) return;

    const kind = (this.requireElement("quick-kind") as HTMLSelectElement).value as NodeKind;
    const parent = (this.requireElement("quick-parent") as HTMLSelectElement).value;
    const color = (this.requireElement("quick-color") as HTMLSelectElement).value;
    const shape = (this.requireElement("quick-shape") as HTMLSelectElement).value;
    const status = (this.requireElement("quick-status") as HTMLSelectElement).value;
    const category = (this.requireElement("quick-category") as HTMLInputElement).value.trim();
    const width = (this.requireElement("quick-width") as HTMLSelectElement).value;
    const font = (this.requireElement("quick-font") as HTMLSelectElement).value;
    const fontSize = (this.requireElement("quick-font-size") as HTMLInputElement).valueAsNumber;
    const fontWeight = (this.requireElement("quick-font-weight") as HTMLSelectElement).value;
    const align = (this.requireElement("quick-align") as HTMLSelectElement).value;
    const text = (this.requireElement("quick-text") as HTMLTextAreaElement).value.trim();
    const answer = (this.requireElement("quick-answer") as HTMLTextAreaElement).value.trim();
    const feature = (this.requireElement("quick-feature") as HTMLInputElement).value.trim();
    const id = this.uniqueNodeId(label);
    const lines = [`${kind} ${id} ${JSON.stringify(label)}`];
    if (text) lines.push(`  @text ${JSON.stringify(text)}`);
    if (answer) lines.push(`  @answer ${JSON.stringify(answer)}`);
    if (feature) lines.push(`  @feature ${JSON.stringify(feature)}`);
    if (color) lines.push(`  @color ${color}`);
    if (shape) lines.push(`  @shape ${shape}`);
    if (status) lines.push(`  @status ${status}`);
    if (category) lines.push(`  @category ${JSON.stringify(category)}`);
    if (width) lines.push(`  @width ${width}`);
    if (font) lines.push(`  @font ${font}`);
    if (Number.isInteger(fontSize)) lines.push(`  @font-size ${fontSize}`);
    if (fontWeight) lines.push(`  @font-weight ${fontWeight}`);
    if (align) lines.push(`  @align ${align}`);
    if (parent) lines.push(`connect ${parent} -> ${id}`);
    this.appendScript(lines);
    labelInput.value = "";
    (this.requireElement("quick-text") as HTMLTextAreaElement).value = "";
    (this.requireElement("quick-answer") as HTMLTextAreaElement).value = "";
    (this.requireElement("quick-feature") as HTMLInputElement).value = "";
    this.updateStatus(t("Added {name}", { name: label }), "working");
    window.setTimeout(() => labelInput.focus(), 0);
  }

  private saveQuickNodeEdit(nodeId: string, options: { close?: boolean; announce?: boolean } = {}): void {
    const node = this.store.get().document?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const label = (this.requireElement("quick-label") as HTMLInputElement).value.trim();
    if (!label) return;
    const kind = (this.requireElement("quick-kind") as HTMLSelectElement).value as NodeKind;
    const text = (this.requireElement("quick-text") as HTMLTextAreaElement).value.trim();
    const answer = (this.requireElement("quick-answer") as HTMLTextAreaElement).value.trim();
    const feature = (this.requireElement("quick-feature") as HTMLInputElement).value.trim();
    const color = (this.requireElement("quick-color") as HTMLSelectElement).value;
    const shape = (this.requireElement("quick-shape") as HTMLSelectElement).value;
    const status = (this.requireElement("quick-status") as HTMLSelectElement).value;
    const category = (this.requireElement("quick-category") as HTMLInputElement).value.trim();
    const width = (this.requireElement("quick-width") as HTMLSelectElement).value;
    const font = (this.requireElement("quick-font") as HTMLSelectElement).value;
    const fontSize = (this.requireElement("quick-font-size") as HTMLInputElement).valueAsNumber;
    const fontWeight = (this.requireElement("quick-font-weight") as HTMLSelectElement).value;
    const align = (this.requireElement("quick-align") as HTMLSelectElement).value;
    const source = this.store.get().source;
    const block = source.slice(node.source.from.offset, node.source.to.offset);
    const existingLines = block.split(/\r?\n/);
    const indent = /^\s*/.exec(existingLines[0] ?? "")?.[0] ?? "";
    const attributeIndent = `${indent}  `;
    const lines = [`${indent}${kind} ${node.id} ${JSON.stringify(label)}`];
    if (text) lines.push(`${attributeIndent}@text ${JSON.stringify(text)}`);
    if (answer) lines.push(`${attributeIndent}@answer ${JSON.stringify(answer)}`);
    if (feature) lines.push(`${attributeIndent}@feature ${JSON.stringify(feature)}`);
    if (color) lines.push(`${attributeIndent}@color ${color}`);
    if (shape) lines.push(`${attributeIndent}@shape ${shape}`);
    if (status) lines.push(`${attributeIndent}@status ${status}`);
    if (category) lines.push(`${attributeIndent}@category ${JSON.stringify(category)}`);
    if (width) lines.push(`${attributeIndent}@width ${width}`);
    if (font) lines.push(`${attributeIndent}@font ${font}`);
    if (Number.isInteger(fontSize)) lines.push(`${attributeIndent}@font-size ${fontSize}`);
    if (fontWeight) lines.push(`${attributeIndent}@font-weight ${fontWeight}`);
    if (align) lines.push(`${attributeIndent}@align ${align}`);
    const editableAttribute = /^\s+@(text|answer|feature|color|shape|status|category|width|font|font-size|font-weight|align)\b/;
    lines.push(...existingLines.slice(1).filter((line) => !editableAttribute.test(line)));
    const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
    const updatedSource = `${source.slice(0, node.source.from.offset)}${lines.join(lineBreak)}${source.slice(node.source.to.offset)}`;
    if (updatedSource !== source) {
      this.syncingQuickEditor = true;
      this.editor?.setValue(updatedSource);
      this.syncingQuickEditor = false;
    }
    if (options.announce !== false) this.updateStatus(t("Updated {name}", { name: label }), "working");
    if (options.close !== false) this.closeQuickBuilder();
  }

  private resizeNode(nodeId: string, size: { width: number; height: number }, position: Point): void {
    const node = this.store.get().document?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const source = this.store.get().source;
    const block = source.slice(node.source.from.offset, node.source.to.offset);
    const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
    const lines = block.split(/\r?\n/);
    const indent = /^\s*/.exec(lines[0] ?? "")?.[0] ?? "";
    const sizeLine = `${indent}  @size ${JSON.stringify(`${size.width}x${size.height}`)}`;
    const existingIndex = lines.findIndex((line, index) => index > 0 && /^\s+@size\b/.test(line));
    if (existingIndex >= 0) lines[existingIndex] = sizeLine;
    else lines.splice(1, 0, sizeLine);

    const updatedSource = `${source.slice(0, node.source.from.offset)}${lines.join(lineBreak)}${source.slice(node.source.to.offset)}`;
    this.store.update({
      selectedNodeId: nodeId,
      positions: { ...this.store.get().positions, [nodeId]: position },
    });
    this.editor?.setValue(updatedSource);
    this.updateStatus(t("Updated {name}", { name: node.label }), "working");
    window.setTimeout(() => this.canvas?.focusNode(nodeId, false), 220);
  }

  private addQuickConnection(event: Event): void {
    event.preventDefault();
    const source = (this.requireElement("quick-source") as HTMLSelectElement).value;
    const target = (this.requireElement("quick-target") as HTMLSelectElement).value;
    const labelInput = this.requireElement("quick-edge-label") as HTMLInputElement;
    if (!source || !target) return;
    const label = labelInput.value.trim();
    this.appendScript([`connect ${source} -> ${target}${label ? ` ${JSON.stringify(label)}` : ""}`]);
    labelInput.value = "";
    this.updateStatus("Connected boxes", "working");
  }

  private addDirectConnection(sourceId: string, targetId: string): void {
    const graphDocument = this.store.get().document;
    if (!graphDocument || sourceId === targetId) return;
    const alreadyConnected = graphDocument.edges.some((edge) => edge.source === sourceId && edge.target === targetId);
    if (alreadyConnected) return;
    this.appendScript([`connect ${sourceId} -> ${targetId}`]);
    this.updateStatus("Connected boxes", "working");
  }

  private renameNode(nodeId: string, nextLabel: string): void {
    const node = this.store.get().document?.nodes.find((candidate) => candidate.id === nodeId);
    const label = nextLabel.trim();
    if (!node || !label || node.label === label) return;
    const source = this.store.get().source;
    const block = source.slice(node.source.from.offset, node.source.to.offset);
    const lines = block.split(/\r?\n/);
    const indent = /^\s*/.exec(lines[0] ?? "")?.[0] ?? "";
    lines[0] = `${indent}${node.kind} ${node.id} ${JSON.stringify(label)}`;
    const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
    const updatedSource = `${source.slice(0, node.source.from.offset)}${lines.join(lineBreak)}${source.slice(node.source.to.offset)}`;
    this.editor?.setValue(updatedSource);
    this.updateStatus(t("Updated {name}", { name: label }), "working");
  }

  private appendScript(lines: string[]): void {
    const source = `${this.store.get().source.trimEnd()}\n\n${lines.join("\n")}\n`;
    this.editor?.setValue(source);
  }

  private uniqueNodeId(label: string): string {
    const existing = new Set(this.store.get().document?.nodes.map((node) => node.id) ?? []);
    const normalized = label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36);
    const base = /^[a-z]/.test(normalized) ? normalized : `node_${normalized || "new"}`;
    let id = base;
    let suffix = 2;
    while (existing.has(id)) {
      id = `${base}_${suffix}`;
      suffix += 1;
    }
    return id;
  }

  private renderDiagnostics(diagnostics: Diagnostic[]): void {
    const count = this.requireElement("diagnostic-count");
    const list = this.requireElement("diagnostic-list");
    count.textContent = String(diagnostics.length);
    list.replaceChildren();

    if (diagnostics.length === 0) {
      const message = document.createElement("p");
      message.className = "empty-message";
      message.textContent = t("No syntax errors.");
      list.append(message);
      return;
    }

    for (const item of diagnostics) {
      const button = document.createElement("button");
      button.className = `diagnostic-item ${item.severity}`;
      button.type = "button";
      const location = document.createElement("span");
      location.className = "diagnostic-location";
      location.textContent = `${item.line}:${item.column}`;
      const text = document.createElement("span");
      text.textContent = item.message;
      button.append(location, text);
      button.addEventListener("click", () => this.editor?.reveal(item.from, item.to));
      list.append(button);
    }
  }

  private onNodesSelected(nodeIds: string[]): void {
    const graphDocument = this.store.get().document;
    const selectedNodes = nodeIds
      .map((nodeId) => graphDocument?.nodes.find((candidate) => candidate.id === nodeId))
      .filter((node): node is GraphNode => node !== undefined);
    this.store.update({ selectedNodeId: selectedNodes[0]?.id ?? null });
    this.renderInspector(selectedNodes[0], selectedNodes.length);
    this.editor?.showNodeSelections(
      selectedNodes.map((node) => ({ from: node.source.from.offset, to: node.source.to.offset })),
    );
  }

  private onCursor(offset: number): void {
    const node = this.store
      .get()
      .document?.nodes.find((candidate) => offset >= candidate.source.from.offset && offset <= candidate.source.to.offset);
    if (!node || node.id === this.store.get().selectedNodeId) return;
    this.store.update({ selectedNodeId: node.id });
    this.renderInspector(node);
    this.canvas?.focusNode(node.id, false);
  }

  private renderInspector(node: GraphNode | undefined, selectionCount = node ? 1 : 0): void {
    const inspector = this.requireElement("node-inspector");
    inspector.replaceChildren();
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = t("SELECTION");
    inspector.append(eyebrow);
    if (!node) {
      const text = document.createElement("p");
      text.textContent = t("Select a node to inspect its source.");
      inspector.append(text);
      return;
    }
    if (selectionCount > 1) {
      const kind = document.createElement("span");
      kind.className = "inspector-kind";
      kind.textContent = t("{count} nodes", { count: selectionCount });
      const heading = document.createElement("strong");
      heading.textContent = t("Multiple nodes selected");
      const meta = document.createElement("p");
      meta.textContent = t("Matching source lines are highlighted in the editor.");
      inspector.append(kind, heading, meta);
      return;
    }
    const kind = document.createElement("span");
    kind.className = "inspector-kind";
    kind.textContent = node.kind;
    const heading = document.createElement("strong");
    heading.textContent = node.label;
    const meta = document.createElement("p");
    meta.textContent = `${node.id} · ${t("line {line} · {priority} priority", {
      line: node.source.from.line,
      priority: node.priority,
    })}`;
    inspector.append(kind, heading, meta);
    const details = [
      ["Category", node.category],
      ["Card width", node.width],
      ["Context", node.text],
      ["Prepared answer", node.answer],
      [this.runnerFeatureLabel(this.store.get().document?.view ?? "tree"), node.feature],
    ] as const;
    for (const [label, value] of details) {
      if (!value) continue;
      const detail = document.createElement("div");
      detail.className = label === "Prepared answer" ? "inspector-detail answer" : "inspector-detail";
      const caption = document.createElement("span");
      caption.textContent = t(label);
      const text = document.createElement("p");
      text.textContent = value;
      detail.append(caption, text);
      inspector.append(detail);
    }
  }

  private autoLayout(): void {
    const state = this.store.get();
    if (!state.document || !this.canvas) return;
    const positions = this.canvas.render(state.document, state.direction, {}, true);
    this.store.update({ positions });
    this.canvas.fit();
    this.scheduleSave();
  }

  private toggleDirection(): void {
    if (this.store.get().document?.view !== "flow") return;
    const direction = this.store.get().direction === "LR" ? "TB" : "LR";
    this.store.update({ direction });
    this.requireElement("direction-button").textContent = t(direction === "LR" ? "Left → right" : "Top → bottom");
    this.autoLayout();
  }

  private setGlobalFontScale(fontScale: number): void {
    if (!Number.isInteger(fontScale) || fontScale < 80 || fontScale > 150) return;
    const source = this.store.get().source;
    const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
    const lines = source.split(/\r?\n/);
    const existingIndex = lines.findIndex((line) => /^@font-scale\s+/.test(line));
    if (fontScale === 100) {
      if (existingIndex >= 0) lines.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      lines[existingIndex] = `@font-scale ${fontScale}`;
    } else {
      const viewIndex = lines.findIndex((line) => /^@view\s+/.test(line));
      const declarationIndex = lines.findIndex((line) => /^(tree|diagram)\s+/.test(line));
      lines.splice(viewIndex >= 0 ? viewIndex + 1 : Math.max(0, declarationIndex + 1), 0, `@font-scale ${fontScale}`);
    }
    this.editor?.setValue(lines.join(lineBreak));
    this.updateStatus(t("Updated {name}", { name: t("Font size") }), "working");
  }

  private updateViewControls(view: DiagramView): void {
    const blank = this.store.get().document?.nodes.length === 0;
    this.requireElement("blank-project-button").dataset.active = String(blank);
    for (const card of this.root.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
      card.dataset.active = String(!blank && card.dataset.preset === view);
    }
    const source = this.store.get().source;
    for (const example of this.root.querySelectorAll<HTMLButtonElement>("[data-example-preset]")) {
      example.dataset.active = String(presetById(example.dataset.examplePreset ?? "")?.source === source);
    }
    const directionButton = this.requireElement("direction-button") as HTMLButtonElement;
    directionButton.disabled = view !== "flow";
    directionButton.textContent = t(
      view === "tree"
        ? "Tree · top down"
        : view === "neural"
          ? "Neural · layered"
          : view === "logic"
            ? "Logic · top down"
            : view === "algorithm"
              ? "Algorithm · top down"
              : view === "data"
                ? "Data · linked"
            : this.store.get().direction === "LR"
              ? "Left → right"
              : "Top → bottom",
    );
  }

  private async startBlankProject(): Promise<void> {
    if (this.store.get().source !== blankProjectSource) {
      const accepted = await this.requestConfirmation({
        title: t("Replace current diagram?"),
        message: t("Start a blank project and replace the current editor content?"),
        confirmLabel: t("Replace"),
      });
      if (!accepted) return;
    }
    this.closeRunner();
    this.closeQuickBuilder();
    this.currentCloudDiagram = null;
    this.setSourceName("untitled.mtree");
    this.store.update({ source: blankProjectSource, positions: {}, direction: "TB", selectedNodeId: null });
    this.editor?.setValue(blankProjectSource, { scrollToTop: true });
    this.compileImmediately(true);
    this.updateStatus(t("Blank project ready"), "ok");
  }

  private async loadPreset(presetId: string): Promise<void> {
    const preset = presetById(presetId);
    if (!preset) return;
    if (this.store.get().source !== preset.source) {
      const accepted = await this.requestConfirmation({
        title: t("Replace current diagram?"),
        message: t("Load this playground template and replace the current editor content?"),
        confirmLabel: t("Replace"),
      });
      if (!accepted) return;
    }
    const direction = preset.view === "flow" || preset.view === "neural" || preset.view === "data" ? "LR" : "TB";
    this.closeTemplateLibrary();
    this.closeQuickBuilder();
    this.currentCloudDiagram = null;
    this.setSourceName(preset.filename);
    this.store.update({ source: preset.source, positions: {}, direction, selectedNodeId: null });
    this.editor?.setValue(preset.source, { scrollToTop: true });
    this.runPath = [];
    this.renderInspector(undefined);
    this.compileImmediately(true);
    this.updateStatus(t("Loaded {name}", { name: t(preset.title) }), "ok");
  }

  private toggleRunner(): void {
    if (this.runnerOpen) {
      this.closeRunner();
      return;
    }
    this.closeQuickBuilder();
    this.closeCanvasContextMenu();
    this.runnerOpen = true;
    this.canvas?.setEditingLocked(true);
    this.requireElement("playground-runner").hidden = false;
    this.requireElement("live-run-button").textContent = t("■ Stop run");
    this.runPath = [];
    this.renderRunner();
  }

  private closeRunner(): void {
    this.runnerOpen = false;
    this.runPath = [];
    this.requireElement("playground-runner").hidden = true;
    this.requireElement("live-run-button").textContent = t("▶ Live run");
    this.canvas?.clearHighlight();
    this.canvas?.setLiveView(null);
    this.canvas?.setEditingLocked(false);
  }

  private runnerBack(): void {
    this.runPath.pop();
    this.renderRunner();
  }

  private runnerReset(): void {
    const graphDocument = this.store.get().document;
    const roots = graphDocument ? this.runnerRoots(graphDocument) : [];
    this.runPath = roots.length === 1 ? [roots[0]!.id] : [];
    this.renderRunner();
  }

  private runnerRoots(graphDocument: GraphDocument): GraphNode[] {
    const incoming = new Set(graphDocument.edges.map((edge) => edge.target));
    const roots = graphDocument.nodes.filter((node) => !incoming.has(node.id));
    return roots.length > 0 ? roots : graphDocument.nodes.slice(0, 1);
  }

  private renderRunner(): void {
    const graphDocument = this.store.get().document;
    const body = this.requireElement("runner-body");
    const title = this.requireElement("runner-title");
    const back = this.requireElement("runner-back") as HTMLButtonElement;
    body.replaceChildren();
    back.disabled = this.runPath.length === 0;

    if (!graphDocument) {
      body.textContent = t("Fix the script before running the playground.");
      return;
    }

    const runner = this.requireElement("playground-runner");
    runner.dataset.view = graphDocument.view;
    this.canvas?.setLiveView(graphDocument.view);
    title.textContent = `${graphDocument.title} · ${graphDocument.view}`;
    if (this.runPath.length === 0) {
      const roots = this.runnerRoots(graphDocument);
      const intro = document.createElement("p");
      intro.className = "runner-prompt";
      intro.textContent = t(roots.length > 1 ? "Choose where the live run starts." : "Start the live flow.");
      body.append(intro);
      for (const node of roots) body.append(this.runnerChoice(node, `Start · ${node.label}`));
      this.canvas?.clearHighlight();
      return;
    }

    const currentId = this.runPath.at(-1)!;
    const current = graphDocument.nodes.find((node) => node.id === currentId);
    if (!current) return;

    const kind = document.createElement("span");
    kind.className = "runner-kind";
    kind.textContent = current.kind;
    const heading = document.createElement("strong");
    heading.className = "runner-current";
    heading.textContent = current.label;
    body.append(kind, heading);

    if (current.text || current.answer || current.feature) {
      const content = document.createElement("section");
      content.className = "runner-node-content";
      if (current.text) content.append(this.runnerDetail("Context", current.text));
      if (current.answer) content.append(this.runnerDetail("Prepared answer", current.answer, true));
      if (current.feature) content.append(this.runnerDetail(this.runnerFeatureLabel(graphDocument.view), current.feature));
      body.append(content);
    }

    const outgoing = graphDocument.edges.filter((edge) => edge.source === current.id);
    if (outgoing.length === 0) {
      const complete = document.createElement("p");
      complete.className = "runner-complete";
      complete.textContent = t("Flow complete. Reset to try another path.");
      body.append(complete);
    } else {
      const prompt = document.createElement("p");
      prompt.className = "runner-prompt";
      prompt.textContent = t(outgoing.length > 1 ? "Choose the next branch:" : "Continue the flow:");
      body.append(prompt);
      for (const edge of outgoing) {
        const target = graphDocument.nodes.find((node) => node.id === edge.target);
        if (!target) continue;
        const label = edge.label ? `${edge.label} · ${target.label}` : target.label;
        body.append(this.runnerChoice(target, label));
      }
    }

    this.canvas?.highlightPath(this.runPath);
    this.canvas?.focusNode(current.id, true);
  }

  private runnerChoice(node: GraphNode, label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "runner-choice";
    const text = document.createElement("span");
    text.textContent = label;
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    button.append(text, arrow);
    button.addEventListener("click", () => {
      this.runPath.push(node.id);
      this.renderRunner();
    });
    return button;
  }

  private runnerDetail(label: string, value: string, answer = false): HTMLElement {
    const detail = document.createElement("div");
    detail.className = answer ? "runner-detail answer" : "runner-detail";
    const caption = document.createElement("span");
    caption.textContent = t(label);
    const text = document.createElement("p");
    text.textContent = value;
    detail.append(caption, text);
    return detail;
  }

  private runnerFeatureLabel(view: DiagramView): string {
    return {
      tree: "Follow-up cue",
      flow: "Expected result",
      neural: "Activation",
      logic: "Branch rule",
      algorithm: "Complexity",
      data: "Operation",
    }[view];
  }

  private async refreshSession(promptSignedOut = false): Promise<void> {
    try {
      this.user = await getSession();
    } catch {
      this.user = null;
    }
    this.renderAccountState();
    if (this.user) await this.refreshCloudLibrary();
    if (!this.user && promptSignedOut) {
      window.setTimeout(() => {
        if (this.user) return;
        this.setAuthTab("register");
        this.openAccountPanel();
        this.setAuthMessage("Create an account to privately save up to 25 diagrams and continue on any device.");
      }, 320);
    }
  }

  private renderAccountState(): void {
    const signedOut = this.requireElement("signed-out-view");
    const signedIn = this.requireElement("signed-in-view");
    signedOut.hidden = this.user !== null;
    signedIn.hidden = this.user === null;
    const accountButton = this.requireElement("account-button");
    accountButton.textContent = t(this.user ? "My diagrams" : "Sign in");
    accountButton.dataset.signedIn = String(this.user !== null);
    this.requireElement("account-email").textContent = this.user?.email ?? "";
  }

  private async signIn(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    this.setAuthMessage("Signing in…");
    try {
      this.user = await login(String(values.get("email") ?? ""), String(values.get("password") ?? ""));
      form.reset();
      this.renderAccountState();
      await this.refreshCloudLibrary();
      this.setAuthMessage("");
    } catch (error) {
      this.setAuthMessage(authErrorMessage(error), true);
    }
  }

  private async createAccount(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();
    this.setAuthMessage("Creating your account…");
    try {
      await register(email, String(values.get("password") ?? ""), String(values.get("full_name") ?? ""));
      const verifyForm = this.requireElement("verify-form") as HTMLFormElement;
      const verifyEmailInput = verifyForm.elements.namedItem("email") as HTMLInputElement;
      verifyEmailInput.value = email;
      form.reset();
      this.setAuthTab("verify");
      this.setAuthMessage("We sent a six-digit verification code to your email.");
    } catch (error) {
      this.setAuthMessage(authErrorMessage(error), true);
    }
  }

  private async verifyAccount(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();
    this.setAuthMessage("Verifying…");
    try {
      await verifyEmail(email, String(values.get("code") ?? ""));
      const loginForm = this.requireElement("login-form") as HTMLFormElement;
      const loginEmailInput = loginForm.elements.namedItem("email") as HTMLInputElement;
      loginEmailInput.value = email;
      form.reset();
      this.setAuthTab("login");
      this.setAuthMessage("Email verified. Sign in to save your diagrams.");
    } catch (error) {
      this.setAuthMessage(authErrorMessage(error), true);
    }
  }

  private async resendVerificationCode(): Promise<void> {
    const form = this.requireElement("verify-form") as HTMLFormElement;
    const email = String(new FormData(form).get("email") ?? "").trim();
    this.setAuthMessage("Sending another code…");
    try {
      await resendVerification(email);
      this.setAuthMessage("A new verification code was sent.");
    } catch (error) {
      this.setAuthMessage(authErrorMessage(error), true);
    }
  }

  private async signOut(): Promise<void> {
    try {
      await logout();
    } catch {
      this.updateStatus("Could not sign out", "error");
      return;
    }
    this.user = null;
    this.cloudDiagrams = [];
    this.currentCloudDiagram = null;
    this.renderAccountState();
    this.setAuthTab("login");
  }

  private setAuthMessage(message: string, isError = false): void {
    const target = this.requireElement("auth-message");
    target.textContent = t(message);
    target.dataset.error = String(isError);
  }

  private async refreshCloudLibrary(): Promise<void> {
    if (!this.user) return;
    try {
      this.cloudDiagrams = await listDiagrams();
      this.renderCloudLibrary();
    } catch (error) {
      const list = this.requireElement("cloud-diagram-list");
      list.textContent = t(authErrorMessage(error));
    }
  }

  private renderCloudLibrary(): void {
    const list = this.requireElement("cloud-diagram-list");
    list.replaceChildren();
    if (this.cloudDiagrams.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = t("No cloud diagrams yet. Save the current canvas to begin.");
      list.append(empty);
      return;
    }
    for (const diagram of this.cloudDiagrams) {
      const item = document.createElement("article");
      item.className = "cloud-diagram-item";
      if (diagram.id === this.currentCloudDiagram?.id) item.dataset.current = "true";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "cloud-diagram-open";
      const title = document.createElement("strong");
      title.textContent = diagram.title;
      const meta = document.createElement("span");
      meta.textContent = `${t(diagram.view.charAt(0).toUpperCase() + diagram.view.slice(1))} · ${new Date(
        diagram.updated_at,
      ).toLocaleDateString(getLocale())}`;
      open.append(title, meta);
      open.addEventListener("click", () => void this.openCloudDiagram(diagram));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button cloud-delete";
      remove.setAttribute("aria-label", t("Delete {name}", { name: diagram.title }));
      remove.textContent = "×";
      remove.addEventListener("click", () => void this.removeCloudDiagram(diagram));
      item.append(open, remove);
      list.append(item);
    }
  }

  private async openCloudDiagram(summary: CloudDiagramSummary): Promise<void> {
    const accepted = await this.requestConfirmation({
      title: t("Replace current diagram?"),
      message: t("Open “{name}” and replace the current canvas?", { name: summary.title }),
      confirmLabel: t("Open"),
    });
    if (!accepted) return;
    let diagram: CloudDiagram;
    try {
      diagram = await getDiagram(summary.id);
    } catch (error) {
      this.updateStatus(authErrorMessage(error), "error");
      return;
    }
    const workspace = diagram.workspace ?? {};
    this.currentCloudDiagram = diagram;
    this.closeQuickBuilder();
    this.setSourceName(this.sourceNameFor(diagram.source, diagram.title));
    this.store.update({
      source: diagram.source,
      direction: workspace.direction ?? "LR",
      positions: workspace.positions ?? {},
      theme: workspace.theme ?? this.store.get().theme,
    });
    this.applyTheme();
    this.editor?.setValue(diagram.source, { scrollToTop: true });
    this.compileImmediately(true);
    this.renderCloudLibrary();
    this.closeAccountPanel();
    this.updateStatus(t("Opened {name}", { name: diagram.title }), "ok");
  }

  private async saveToCloud(): Promise<void> {
    if (!this.user) {
      this.openAccountPanel();
      this.setAuthMessage("Sign in or create an account to save this diagram.");
      this.updateStatus("Sign in or create an account to save this diagram.", "error");
      return;
    }
    // The editor's normal compile is debounced. Saving must always use the
    // exact source and rendered workspace visible at the moment of the click.
    this.compileImmediately(false);
    const state = this.store.get();
    if (!state.document) {
      this.updateStatus("Fix script issues before cloud save", "error");
      return;
    }
    const currentTitle = this.currentCloudDiagram?.title ?? state.document.title;
    const requestedTitle = window.prompt("Name this diagram", currentTitle);
    if (requestedTitle === null) {
      this.updateStatus("Cloud save cancelled", "ok");
      return;
    }
    const title = requestedTitle.trim();
    if (!title || title.length > 160) {
      this.updateStatus("Enter a diagram name between 1 and 160 characters", "error");
      return;
    }
    const payload = {
      title,
      source: state.source,
      view: state.document.view,
      workspace: { direction: state.direction, positions: state.positions, theme: state.theme },
    };
    this.updateStatus("Saving to cloud…", "working");
    try {
      this.currentCloudDiagram = this.currentCloudDiagram
        ? await updateDiagram({ ...this.currentCloudDiagram, ...payload })
        : await createDiagram(payload);
      await this.refreshCloudLibrary();
      this.updateStatus("Saved to cloud", "ok");
    } catch (error) {
      this.updateStatus(authErrorMessage(error), "error");
    }
  }

  private async removeCloudDiagram(diagram: CloudDiagramSummary): Promise<void> {
    const accepted = await this.requestConfirmation({
      title: t("Delete cloud diagram?"),
      message: t("Delete “{name}” from the cloud?", { name: diagram.title }),
      confirmLabel: t("Delete"),
      tone: "danger",
    });
    if (!accepted) return;
    try {
      await deleteDiagram(diagram.id);
      if (this.currentCloudDiagram?.id === diagram.id) this.currentCloudDiagram = null;
      await this.refreshCloudLibrary();
    } catch (error) {
      this.updateStatus(authErrorMessage(error), "error");
    }
  }

  private toggleTheme(): void {
    const theme = this.store.get().theme === "dark" ? "light" : "dark";
    this.store.update({ theme });
    this.applyTheme();
    this.canvas?.refreshTheme();
    this.scheduleSave();
  }

  private requestConfirmation(options: ConfirmationOptions): Promise<boolean> {
    if (this.confirmationResolver) this.resolveConfirmation(false);
    const panel = this.requireElement("confirmation-panel");
    const accept = this.requireElement("confirmation-accept") as HTMLButtonElement;
    this.confirmationPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.requireElement("confirmation-title").textContent = options.title;
    this.requireElement("confirmation-message").textContent = options.message;
    accept.textContent = options.confirmLabel;
    panel.dataset.tone = options.tone ?? "default";
    panel.hidden = false;
    window.setTimeout(() => accept.focus(), 0);
    return new Promise((resolve) => {
      this.confirmationResolver = resolve;
    });
  }

  private resolveConfirmation(accepted: boolean): void {
    const resolve = this.confirmationResolver;
    if (!resolve) return;
    this.confirmationResolver = null;
    this.requireElement("confirmation-panel").hidden = true;
    this.confirmationPreviousFocus?.focus();
    this.confirmationPreviousFocus = null;
    resolve(accepted);
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.store.get().theme;
  }

  private scheduleSave(): void {
    this.updateSaveIndicator(true);
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.persist(), 350);
  }

  private async persist(): Promise<void> {
    const state = this.store.get();
    try {
      await saveProject({
        id: "default",
        sourceName: this.sourceName,
        source: state.source,
        direction: state.direction,
        theme: state.theme,
        positions: state.positions,
        updatedAt: new Date().toISOString(),
      });
      this.updateSaveIndicator(false);
    } catch {
      this.updateStatus("Local save failed", "error");
    }
  }

  private async safeLoad(): Promise<SavedProject | null> {
    try {
      return await loadProject();
    } catch {
      return null;
    }
  }

  private async importFile(): Promise<void> {
    const file = this.fileInput().files?.[0];
    if (!file) return;
    try {
      if (file.size > maxImportBytes) throw new Error("Import files must be 1 MB or smaller.");
      const text = await file.text();
      this.currentCloudDiagram = null;
      this.closeQuickBuilder();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = importBundleSchema.safeParse(JSON.parse(text) as unknown);
        if (!parsed.success) throw new Error("Invalid BranchScript project file.");
        const bundle = parsed.data;
        this.store.update({
          source: bundle.source,
          direction: bundle.workspace?.direction ?? "LR",
          positions: bundle.workspace?.positions ?? {},
          theme: bundle.workspace?.theme ?? this.store.get().theme,
        });
        this.applyTheme();
        this.setSourceName(bundle.sourceName ?? this.sourceNameFor(bundle.source, file.name.replace(/\.json$/i, "")));
        this.editor?.setValue(bundle.source, { scrollToTop: true });
      } else {
        this.store.update({ source: text, positions: {} });
        this.setSourceName(file.name);
        this.editor?.setValue(text, { scrollToTop: true });
      }
      this.compileImmediately(true);
    } catch (error) {
      this.updateStatus(error instanceof Error ? error.message : "Import failed", "error");
    } finally {
      this.fileInput().value = "";
    }
  }

  private exportSource(): void {
    this.download(this.sourceName, this.store.get().source, "text/plain;charset=utf-8");
  }

  private exportProject(): void {
    const state = this.store.get();
    const bundle: ExportBundle = {
      format: "branchscript-project",
      version: "0.1",
      sourceName: this.sourceName,
      source: state.source,
      workspace: {
        direction: state.direction,
        positions: state.positions,
        theme: state.theme,
      },
    };
    this.download("branchscript-project.json", JSON.stringify(bundle, null, 2), "application/json");
  }

  private sourceNameFor(source: string, fallbackTitle?: string): string {
    if (source === defaultSource) return "software-interview.mtree";
    if (source === blankProjectSource) return "untitled.mtree";
    const preset = playgroundPresets.find((candidate) => candidate.source === source);
    if (preset) return preset.filename;
    const title = fallbackTitle ?? compileMindTree(source).document?.id ?? "untitled";
    return this.normalizeSourceName(title);
  }

  private normalizeSourceName(value: string): string {
    const basename = value.split(/[\\/]/).at(-1) ?? "untitled";
    const stem = basename
      .replace(/\.(?:mtree|json)$/i, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 112);
    return `${stem || "untitled"}.mtree`;
  }

  private setSourceName(value: string): void {
    this.sourceName = this.normalizeSourceName(value);
    this.updateSourceName();
  }

  private updateSourceName(): void {
    const target = this.root.querySelector<HTMLElement>("#source-file-name");
    if (target) target.textContent = this.sourceName;
  }

  private download(filename: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private updateStatus(message: string, status: "ok" | "working" | "error"): void {
    this.requireElement("status-text").textContent = t(message);
    this.requireElement("save-indicator").dataset.status = status;
  }

  private updateSaveIndicator(saving: boolean): void {
    const indicator = this.requireElement("save-indicator");
    if (!saving && indicator.dataset.status === "error") return;
    indicator.dataset.status = saving ? "working" : "ok";
    if (!saving && this.store.get().diagnostics.length === 0) {
      this.requireElement("status-text").textContent = t("Saved locally");
    }
  }

  private requireElement(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`Missing application element: ${id}`);
    return element;
  }

  private fileInput(): HTMLInputElement {
    const input = this.root.querySelector<HTMLInputElement>("#file-input");
    if (!input) throw new Error("Missing file input.");
    return input;
  }
}
