# Architecture

BranchScript combines a local-first TypeScript workbench with static SEO pages. `.mtree` source is the primary document; visual positions are workspace state.

## Data flow

```text
.mtree source
  -> Lezer syntax tree
  -> semantic compiler
  -> validated GraphDocument
  -> view-aware Dagre layout
  -> AntV X6 canvas
```

CodeMirror owns text editing and text undo history. X6 owns viewport interaction and node-position history. The application store coordinates selection, diagnostics, diagram view, layout direction, theme, and persistence.

The playground runner reads the same validated `GraphDocument` shown on the canvas. It traverses outgoing edges without executing source code, and asks the canvas to highlight the selected path.

The visual builder also preserves the source-first model. Form actions append valid node declarations, visual attributes, and connections to `.mtree`; they do not mutate the compiled graph directly.

## Boundaries

- `src/domain` contains serializable graph types and schemas.
- `src/scripting` parses source and produces domain documents.
- `src/editor` contains CodeMirror language support and editor behavior.
- `src/canvas` contains layout and X6 rendering.
- `src/playground` contains ready-to-edit example documents.
- `src/storage` contains browser persistence.
- `src/auth` contains the same-origin identity and cloud diagram API client.
- `src/app` coordinates the working surface.
- `index.html`, `blog`, and `faq` are crawlable multi-page content entries.

## Persistence

The source, layout direction, theme, and node positions are stored in IndexedDB. Import and export remain explicit so a project is not tied to one browser profile.

Signed-in users may also save private diagrams through the same-origin cloud API. BranchScript users and diagrams belong to the private BranchScript PostgreSQL database. Neuralith runs the identity and mail flow through a scoped database connection; its primary user table is not shared with BranchScript. The backend implementation and deployment configuration are maintained separately from this public web repository.

```text
browser
  -> /api/v1/auth/branchscript/* -> account service
  -> /api/v1/branchscript/*      -> diagram service
```

## Dependency policy

Runtime dependencies must use permissive open-source licenses and must not require a production license key. Vite produces `dist/licenses.md` during a production build.
