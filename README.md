# BranchScript

BranchScript turns a small, readable script into explorable thought trees, visual flows, algorithms, and data structures. It is designed for preparing possible responses to interview, exam, and discussion prompts, as well as mapping ideas, processes, and computer science concepts.

The application is built with TypeScript and browser-native APIs. It does not use React or JSX.

## Features

- Live `.mtree` editing with syntax highlighting and diagnostics
- Typed compilation into a versioned graph document
- Six ready-to-edit views: tree, flow, neural, logic, algorithm, and data
- Live playground for stepping through branches and highlighting the active path
- Visual builder for adding, connecting, and double-click editing boxes without writing source
- In-app syntax guide with practical examples
- Infinite canvas with pan, zoom, selection, minimap, and search
- Collapsible, keyboard-accessible source panel with a draggable persistent width
- View-aware nodes, connections, and automatic layout
- Responsive mobile workspace with dedicated Source and Canvas views
- Local IndexedDB persistence
- Email accounts with verification and private cloud diagram saving in the BranchScript backend
- `.mtree` and complete project export
- Static SEO landing, blog, and FAQ pages
- Landing-page quick start, visual examples, syntax anatomy, and self-hosting guide
- No telemetry, React, JSX, or paid runtime dependency

## Development

```bash
npm install
npm run dev
```

The editor is available at `http://127.0.0.1:5173/app/`. Local editing, IndexedDB saving, and project export work without an account. Cloud account and diagram features require the separately maintained backend services.

Quality checks:

```bash
npm run check
```

Browser tests use Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

## Technology

- TypeScript and Vite
- AntV X6
- CodeMirror and Lezer
- Dagre
- Zod
- IndexedDB
- Vitest and Playwright

All runtime dependencies are selected from permissively licensed open-source projects and do not require a production license key.

## Language

See [docs/language.md](docs/language.md) for the `.mtree` syntax.

```text
diagram response_logic "Response Selection Logic"
@view logic

input prompt "Incoming question"
decision has_example "Do I have a strong real example?"
process answer "Answer with the STAR structure"
outcome fallback "Give a concise fallback answer"

connect prompt -> has_example
connect has_example -> answer "yes"
connect has_example -> fallback "no"
```

Pseudocode and data structures use dedicated node types:

```text
diagram search "Binary Search"
@view algorithm

start begin "sorted values and target"
condition found "values[mid] == target?"
return done "return mid"

connect begin -> found
connect found -> done "yes"
```

Data structures can show their internal cells and fields directly:

```text
diagram cache "Cache Structures"
@view data

array keys "Keys"
  @items "user:42 | user:73 | user:91"
  @feature "Lookup: O(1) average"
record entry "Cache entry"
  @fields "key = user:42 | ttl = 300 | value = Ada"
pointer next "next → entry"

connect keys -> entry "index 0"
connect entry -> next "linked reference"
```

Use `@items` for ordered cells in arrays, stacks, queues, and linked lists. Use `@fields` for key-value rows in records, and connect `pointer` nodes to make references explicit. The Data playground contains all of these structures as a ready-to-edit example.

Boxes can also be styled directly:

```text
step prototype "Build a focused prototype"
  @color green
  @shape pill
  @status active
```

Keep short titles readable while storing preparation detail inside each box:

```text
question ownership "What did you own?"
  @text "Clarify your personal scope."
  @answer "I owned the API contract, rollout, and production dashboards."
  @feature "Follow-up: explain a trade-off"
```

Live Run presents these fields as recall cards. Each visual view has its own motion language: branching for trees, forward movement for flows, pulses for neural maps, decision flashes for logic, stepped scans for algorithms, and shifting cells for data structures.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the data flow and module boundaries.

## Deployment

The public production image contains only the static build and an unprivileged Nginx runtime. Cloud backend and infrastructure configuration are maintained separately.

For the production topology, create the shared Docker network first and then run the public web service:

```bash
docker network inspect neuralith-shared >/dev/null 2>&1 || docker network create neuralith-shared
docker compose up -d --build
```

The public Compose file intentionally uses `expose: 8080` instead of publishing a host port. The Neuralith gateway reaches it through `neuralith-shared`. The private backend and its PostgreSQL database are started from the separate `mindful-tree-visualized-web-backend` repository after its `.env` file is configured. For a browser-only local check, use `npm run dev`.

Security issues should be reported privately as described in [SECURITY.md](SECURITY.md).

## Progress

Development notes are recorded by date under [`docs/progress`](docs/progress).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

A project license has not been selected yet. Third-party dependency licenses are emitted to `dist/licenses.md` during production builds.
