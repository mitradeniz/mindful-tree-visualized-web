# Project saving and drawing

## Save, Save as, and local backup

- **Save project** creates a named private cloud record on first save. Subsequent saves update that same record without asking for its name again.
- **Save as** always asks for a name and creates a separate cloud record. The copy becomes the active project.
- Content, layout direction, node positions, and drawings mark the project as changed. Merely selecting a node, zooming, searching, or switching the UI theme does not.
- The Save button is highlighted after changes. An imported `.mtree` or workspace `.json` highlights Save as and does not overwrite the previously open cloud diagram.
- Unmodified templates and freshly opened blank/cloud diagrams switch without a warning. Modified or imported projects offer **Save and continue**, **Discard changes**, and **Cancel**. Failed or cancelled saves do not continue the switch.
- `Ctrl/Cmd+S` saves; `Ctrl/Cmd+Shift+S` saves a copy. Mobile has a **Project** menu with saving, library, and profile actions.
- Local IndexedDB backup is separate from cloud saving. Reloading retains the dirty state and the active cloud record reference for the same signed-in user. The saved revision is retained so the API can reject conflicting changes made on another device.

Cloud saving still requires authentication and uses the existing 25-diagram API quota. These UI changes do not require new endpoints or database migrations. An unavailable server cannot be fixed by the frontend alone; failed requests remain visible and the document remains unsaved.

## Drawing annotations

The canvas toolbar offers a pen, line, rectangle, ellipse, diamond, stroke color/width, and eraser. Draw with a mouse, pen, or one touch pointer. Switch back to **Select / move** to navigate and edit diagram nodes. The eraser removes an entire drawing stroke, not graph nodes. Undo/redo uses the source editor history; each completed drawing is a separate undo step.

Annotations are stored in fixed canvas-pixel coordinates. Canvas pan, zoom, fit view, and automatic layout therefore do not resize or move them. They round-trip through local backup, cloud saves, `.mtree` export, and workspace `.json` export as bounded JSON comments:

```text
# branchscript-drawing {"id":"example","tool":"line","color":"#149b83","width":3,"points":[{"x":10,"y":10},{"x":80,"y":40}]}
```

They are decorative annotations, not connectable/executable graph nodes. They are not included in minimap rendering or automatic graph layout. The reader validates geometry and colors; malformed annotations are ignored. Limits: 500 strokes, 2,048 points per stroke, and the existing total source/import size limits.

## Examples and profile

**Examples for this diagram** opens the library filtered to the current diagram type, including Tree and Flow. Choosing an example replaces the document, subject to the unsaved-changes prompt.

The **Profile** panel shows the signed-in name, email, current cloud-diagram quota, library access, and sign-out. It does not edit account details or passwords.

## Local verification

```sh
npm run check
npx playwright test tests/e2e/project-workflow.spec.ts tests/e2e/cloud-project-workflow.spec.ts --workers=2
```

Cloud tests intercept API requests locally; they do not create real accounts/diagrams or start GitHub Actions.
