# Contributing

BranchScript is an early-stage project. Keep changes focused, typed, and covered by tests where behavior changes.

## Setup

```bash
npm install
npm run dev
```

Run the complete local quality gate before opening a pull request:

```bash
npm run check
```

Browser tests require a Playwright browser installation:

```bash
npx playwright install chromium
npm run test:e2e
```

## Code style

- Use TypeScript. Do not add React, JSX, or a frontend framework.
- Keep the domain and scripting layers independent from the DOM.
- Add comments only when the reason behind a decision is not clear from the code.
- Do not add runtime dependencies without checking their license and maintenance status.
- Preserve `.mtree` compatibility or document a format migration.
