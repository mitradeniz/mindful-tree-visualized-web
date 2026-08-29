import { expect, test, type Page } from "@playwright/test";

const compactAnswerSource = `diagram tree "Answer card test"
@view tree

topic intro "Introduction"
  response concise "Backend-focused introduction"
    @answer "I build reliable backend systems and own services from API design through production."
    @feature "Present → evidence → role fit"
    @tag preferred
    @priority high`;

async function loadCompactAnswer(page: Page): Promise<void> {
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await page.keyboard.insertText(compactAnswerSource);
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "2");
}

test("renders the example script as a thought tree", async ({ page }) => {
  await page.goto("/app/");

  await expect(page.getByRole("heading", { name: "BranchScript" })).toBeVisible();
  await expect(page.getByText("No syntax errors.")).toBeVisible();
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "16");
  await expect(page.locator("#source-file-name")).toHaveText("software-interview.mtree");
});

test("resets the editor viewport for examples and can start blank", async ({ page }) => {
  await page.goto("/app/");
  const scroller = page.locator(".cm-scroller");
  await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });

  await page.getByRole("button", { name: "Load Flow template" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();

  await expect(page.locator("#source-file-name")).toHaveText("idea-to-launch.mtree");
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeLessThan(2);
  await expect(page.locator(".cm-line").first()).toContainText("diagram launch_flow");

  await page.getByRole("button", { name: "Start blank project" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();

  await expect(page.locator("#source-file-name")).toHaveText("untitled.mtree");
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "0");
  await expect(page.getByText("No syntax errors.")).toBeVisible();
  await expect(page.locator(".cm-line").first()).toContainText('diagram untitled "Untitled"');

  await page.locator("#add-node-button").click();
  await page.getByLabel("Box text").fill("First thought");
  await page.locator("#quick-node-submit").click();
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "1");
  await expect(page.locator(".cm-content")).toContainText('process first_thought "First thought"');
});

test("shows System Design as a disabled coming-soon view", async ({ page }) => {
  await page.goto("/app/");

  const card = page.getByRole("button", { name: "System Design: Coming soon" });
  await expect(card).toBeVisible();
  await expect(card).toBeDisabled();

  const cardBox = await card.boundingBox();
  const dockBox = await page.locator(".preset-dock").boundingBox();
  const workspaceBox = await page.locator(".workspace").boundingBox();
  expect(cardBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(workspaceBox).not.toBeNull();
  if (!cardBox || !dockBox || !workspaceBox) return;
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(dockBox.x + dockBox.width + 1);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(workspaceBox.y + 1);
});

test("keeps data cell labels inside their cards", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Load Data template" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "10");
  await page.getByRole("button", { name: "Fit view" }).click();

  const node = page.locator('#graph-canvas .x6-node[data-cell-id="scores"]');
  await expect(node).toBeVisible();
  await node.dblclick();
  const body = await node.locator(".branchscript-node-body").boundingBox();
  const values = await node.locator('text[font-size="10"]').all();
  expect(body).not.toBeNull();
  expect(values).toHaveLength(4);
  if (!body) return;
  for (const value of values) {
    const box = await value.boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(body.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(body.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(body.x + body.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(body.y + body.height + 1);
  }
});

test("opens and exits canvas full screen", async ({ page }) => {
  await page.goto("/app/");
  const panel = page.locator(".canvas-panel");

  await page.getByRole("button", { name: "Full screen" }).click();
  await expect.poll(() => panel.evaluate((element) => document.fullscreenElement === element)).toBe(true);
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();

  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect.poll(() => panel.evaluate((element) => document.fullscreenElement === element)).toBe(false);
});

test("keeps prepared answers inside their visual cards", async ({ page }) => {
  await page.goto("/app/");
  await loadCompactAnswer(page);
  const node = page.locator('#graph-canvas .x6-node[data-cell-id="concise"]');
  await expect(node).toBeVisible();

  const body = await node.locator(".branchscript-node-body").boundingBox();
  const answer = await node.locator('text[font-size="11"]').boundingBox();
  const feature = await node.locator('text[font-size="8"]').last().boundingBox();
  expect(body).not.toBeNull();
  expect(answer).not.toBeNull();
  expect(feature).not.toBeNull();
  if (!body || !answer || !feature) return;

  expect(answer.y).toBeGreaterThanOrEqual(body.y);
  expect(answer.y + answer.height).toBeLessThanOrEqual(body.y + body.height + 1);
  expect(feature.y + feature.height).toBeLessThanOrEqual(body.y + body.height + 1);
});

test("keeps the last valid graph when the script becomes invalid", async ({ page }) => {
  await page.goto("/app/");
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "16");

  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await page.keyboard.type("question broken");

  await expect(page.getByText("Unrecognized BranchScript statement.")).toBeVisible();
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "16");
});

test("exports the source document", async ({ page }) => {
  await page.goto("/app/");
  const downloadPromise = page.waitForEvent("download");

  await page.getByRole("button", { name: "Export .mtree" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("software-interview.mtree");
});

test("requires sign-in before saving the project", async ({ page }) => {
  await page.goto("/app/");

  await page.getByRole("button", { name: "Save project" }).click();

  await expect(page.locator("#account-panel")).toBeVisible();
  await expect(page.locator("#auth-message")).toHaveText("Sign in or create an account to save this diagram.");
});

test("loads a logic template and runs its branches live", async ({ page }) => {
  await page.goto("/app/");

  await page.getByRole("button", { name: "Load Logic template" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Replace current diagram?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Replace" }).click();
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "7");

  await page.getByRole("button", { name: "Live run" }).click();
  const runner = page.locator("#playground-runner");
  await expect(runner).toBeVisible();
  await expect(runner).toHaveAttribute("data-view", "logic");
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-live-view", "logic");
  await runner.getByRole("button", { name: /Start · Incoming question/ }).click();
  await expect(runner.getByText("Incoming question", { exact: true })).toBeVisible();
  await expect(runner.getByText("Identify whether the question asks for behavior, knowledge, or judgment.")).toBeVisible();
  await expect(runner.getByText("Branch rule", { exact: true })).toBeVisible();
  await runner.getByRole("button", { name: /Do I have a strong real example/ }).click();
  await runner.getByRole("button", { name: /yes · Answer with the STAR structure/ }).click();
  await expect(runner.getByText("Answer with the STAR structure", { exact: true })).toBeVisible();

  await runner.getByRole("button", { name: "Reset" }).click();
  await expect(runner.getByText("Incoming question", { exact: true })).toBeVisible();
  await expect(runner.getByRole("button", { name: /Start ·/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Stop run" }).click();
  await expect(runner).toBeHidden();
});

test("keeps a focused logic branch inside the visible canvas", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Load Logic template" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();

  const canvas = page.locator("#graph-canvas");
  const decision = canvas.locator('.x6-node[data-cell-id="has_example"]');
  await decision.dblclick();

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;
  for (const id of ["prompt", "has_example", "use_star", "concise"]) {
    const box = await canvas.locator(`.x6-node[data-cell-id="${id}"]`).boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
  }
});

test("keeps the current diagram when an in-app template warning is cancelled", async ({ page }) => {
  await page.goto("/app/");
  const sourceBefore = await page.locator(".cm-content").textContent();

  await page.getByRole("button", { name: "Load Flow template" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Replace current diagram?" });
  await expect(confirmation).toContainText("Load this playground template");
  await confirmation.getByRole("button", { name: "Cancel" }).click();

  await expect(confirmation).toBeHidden();
  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "16");
  await expect(page.locator(".cm-content")).toHaveText(sourceBefore ?? "");
});

test("adds a styled box without writing script", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Open visual builder" }).click();

  const builder = page.locator("#quick-builder");
  await expect(builder).toBeVisible();
  await expect(builder.locator("#quick-advanced-settings")).toBeHidden();
  await builder.getByRole("button", { name: "Show advanced settings" }).click();
  await expect(builder.locator("#quick-advanced-settings")).toBeVisible();
  await builder.getByLabel("Box text").fill("Visual node");
  await builder.getByLabel("Supporting text").fill("A concise reminder shown inside the box.");
  await builder.getByLabel("Prepared answer").fill("I would answer with context, action, and a measurable result.");
  await builder.getByLabel("Relevant property").fill("follow-up: trade-offs");
  await builder.locator("#quick-kind").selectOption("decision");
  await builder.locator("#quick-color").selectOption("amber");
  await builder.locator("#quick-status").selectOption("active");
  await builder.getByRole("button", { name: "Add box" }).click();

  await expect(page.locator("#graph-canvas")).toHaveAttribute("data-node-count", "17");
  await expect(page.locator(".cm-content")).toContainText('decision visual_node "Visual node"');
  await expect(page.locator(".cm-content")).toContainText('@text "A concise reminder shown inside the box."');
  await expect(page.locator(".cm-content")).toContainText('@answer "I would answer with context, action, and a measurable result."');
  await expect(page.locator(".cm-content")).toContainText('@feature "follow-up: trade-offs"');
  await expect(page.locator(".cm-content")).toContainText("@color amber");
  await expect(page.locator("#graph-canvas .x6-node").last()).toContainText("I would answer");
});

test("edits an existing box after double click", async ({ page }) => {
  await page.goto("/app/");
  await loadCompactAnswer(page);
  const node = page.locator('#graph-canvas .x6-node[data-cell-id="concise"]');

  await node.dblclick();

  const scale = await page.locator("#graph-canvas .x6-graph-svg-viewport").evaluate((element) =>
    (element as SVGGraphicsElement).getCTM()?.a ?? 0,
  );
  expect(scale).toBeCloseTo(1.25, 1);

  const builder = page.locator("#quick-builder");
  await expect(builder).toBeVisible();
  await expect(builder.getByText("Edit box", { exact: true })).toBeVisible();
  await expect(builder.getByLabel("Box text")).toHaveValue("Backend-focused introduction");
  await expect(builder.getByLabel("Prepared answer")).toHaveValue(/I build reliable/);
  await expect(builder.getByLabel("Connect after")).toBeHidden();
  await expect(builder.getByLabel("Type")).toBeVisible();

  await builder.getByLabel("Box text").fill("Backend platform introduction");
  await builder.getByLabel("Prepared answer").fill("I owned the platform API and rollout.");
  await builder.getByLabel("Relevant property").fill("Follow-up: scale and trade-offs");
  await builder.getByRole("button", { name: "Save changes" }).click();

  await expect(builder).toBeHidden();
  await expect(page.locator(".cm-content")).toContainText('response concise "Backend platform introduction"');
  await expect(page.locator(".cm-content")).toContainText('@answer "I owned the platform API and rollout."');
  await expect(page.locator(".cm-content")).toContainText('@feature "Follow-up: scale and trade-offs"');
  await expect(page.locator(".cm-content")).toContainText("@tag preferred");
  await expect(page.locator(".cm-content")).toContainText("@priority high");
  await expect(node).toContainText("Backend platform introduction");
});

test("opens the in-app syntax guide", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Syntax guide" }).click();

  const guide = page.locator("#learn-panel");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("Learn in five moves")).toBeVisible();
  await expect(guide.getByText('@answer "Prepared answer"', { exact: false })).toBeVisible();
  await expect(guide.getByText('connect intro -> concise "choose"')).toBeVisible();
});

test("gives every diagram a distinct live-run motion language", async ({ page }) => {
  await page.goto("/app/");
  const modes = [
    ["Tree", "tree", "live-tree-branch"],
    ["Flow", "flow", "live-flow-forward"],
    ["Neural", "neural", "live-neural-pulse"],
    ["Logic", "logic", "live-logic-decide"],
    ["Algorithm", "algorithm", "live-algorithm-scan"],
    ["Data", "data", "live-data-shift"],
  ] as const;

  for (const [name, view, animation] of modes) {
    await page.getByRole("button", { name: `Load ${name} template` }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Replace current diagram?" });
    await confirmation.getByRole("button", { name: "Replace" }).click();
    await page.getByRole("button", { name: "Live run" }).click();

    const runner = page.locator("#playground-runner");
    await expect(runner).toHaveAttribute("data-view", view);
    await expect(runner.locator(".runner-choice").first()).toBeVisible();
    const declaredAnimation = await page.evaluate((activeView) => {
      const selector = `.playground-runner[data-view="${activeView}"] .runner-choice`;
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText === selector) return rule.style.animationName;
        }
      }
      return "";
    }, view);
    expect(declaredAnimation).toBe(animation);

    await page.getByRole("button", { name: "Stop run" }).click();
  }
});

test("mirrors multiple canvas selections in the source editor", async ({ page }) => {
  await page.goto("/app/");

  const nodes = page.locator("#graph-canvas .x6-node");
  await nodes.nth(1).click();
  await nodes.nth(2).click({ modifiers: ["Meta"] });

  expect(await page.locator(".cm-node-selection-line").count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#node-inspector")).toContainText("2 nodes");
});

test("opens contextual canvas actions with right click", async ({ page }) => {
  await page.goto("/app/");

  await page.locator("#graph-canvas .x6-node").first().click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Canvas actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Add connected box" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Add connected box" }).click();

  await expect(page.locator("#quick-builder")).toBeVisible();
  await expect(page.locator("#quick-parent")).not.toHaveValue("");
});

test("changes the workspace language without changing the script", async ({ page }) => {
  await page.goto("/app/");
  const source = await page.locator(".cm-content").textContent();

  await page.locator("#language-select").selectOption("tr");

  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.getByRole("link", { name: "Ana sayfa" })).toBeVisible();
  await expect(page.getByPlaceholder("Kutularda ara")).toBeVisible();
  await expect(page.locator(".cm-content")).toHaveText(source ?? "");
});

test("uses translucent color surfaces for controls and graph nodes in light mode", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Toggle theme" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.waitForTimeout(200);
  const cardBackground = await page.locator(".preset-card").first().evaluate((element) => getComputedStyle(element).backgroundColor);
  const nodeFill = await page.locator(".branchscript-node-body").first().evaluate((element) => getComputedStyle(element).fill);

  expect(cardBackground).toMatch(/(?:rgba\(.*0\.|\/\s*0\.)/);
  expect(nodeFill).toMatch(/(?:rgba\(.*0\.|\/\s*0\.)/);
  expect(nodeFill).not.toMatch(/255\s*,\s*255\s*,\s*255/);
});

test("collapses, restores, and resizes the source panel", async ({ page }) => {
  await page.goto("/app/");
  const workspace = page.locator(".workspace");
  const editor = page.locator(".editor-panel");
  const resizer = page.locator("#workspace-resizer");
  const before = await editor.boundingBox();
  const handle = await resizer.boundingBox();
  expect(before).not.toBeNull();
  expect(handle).not.toBeNull();
  if (!before || !handle) return;

  await page.mouse.move(handle.x + handle.width / 2, handle.y + 120);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 110, handle.y + 120, { steps: 5 });
  await page.mouse.up();
  const resized = await editor.boundingBox();
  expect(resized?.width ?? 0).toBeGreaterThan(before.width + 90);

  await page.reload();
  const restored = await editor.boundingBox();
  expect(Math.abs((restored?.width ?? 0) - (resized?.width ?? 0))).toBeLessThan(4);

  await page.getByRole("button", { name: "Hide source panel" }).click();
  await expect(workspace).toHaveAttribute("data-source-collapsed", "true");
  await expect(editor).toBeHidden();
  await expect(page.getByRole("button", { name: "Show source panel" })).toBeVisible();

  await page.getByRole("button", { name: "Show source panel" }).click();
  await expect(workspace).toHaveAttribute("data-source-collapsed", "false");
  await expect(editor).toBeVisible();
});

test("keeps the zoom anchor fixed during modified wheel zoom", async ({ page }) => {
  await page.goto("/app/");
  const node = page.locator("#graph-canvas .x6-node").first();
  const before = await node.boundingBox();
  expect(before).not.toBeNull();
  if (!before) return;

  const anchor = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  await page.mouse.move(anchor.x, anchor.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");

  const after = await node.boundingBox();
  expect(after).not.toBeNull();
  if (!after) return;
  expect(Math.abs(after.x + after.width / 2 - anchor.x)).toBeLessThan(3);
  expect(Math.abs(after.y + after.height / 2 - anchor.y)).toBeLessThan(3);
  expect(after.width).toBeGreaterThan(before.width);
});

test("keeps the localized workspace inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/");
  await page.locator("#language-select").selectOption("tr");

  await expect(page.getByRole("button", { name: "Tuval" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kaynak" })).toBeVisible();
  await expect(page.locator("#workspace-resizer")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("prevents browser text selection outside editable controls", async ({ page }) => {
  await page.goto("/app/");

  await page.locator(".canvas-panel").click({ position: { x: 500, y: 400 } });
  await page.keyboard.press("ControlOrMeta+A");
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  expect(await page.locator(".brand-block h1").evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
  expect(await page.locator(".cm-content").evaluate((element) => getComputedStyle(element).userSelect)).toBe("text");
});

test("renders imported script content as text and rejects oversized files", async ({ page }) => {
  await page.goto("/app/");
  await page.evaluate(() => Object.assign(window, { branchScriptXssProbe: false }));

  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await page.keyboard.type('question safe "<img src=x onerror=branchScriptXssProbe=true>"');

  await expect(page.locator('#graph-canvas .x6-node[data-cell-id="safe"]')).toContainText("<img src=x");
  expect(await page.evaluate(() => (window as Window & { branchScriptXssProbe?: boolean }).branchScriptXssProbe)).toBe(false);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  await page.locator("#file-input").setInputFiles({
    name: "oversized.mtree",
    mimeType: "text/plain",
    buffer: Buffer.alloc(1_048_577, 97),
  });
  await expect(page.getByText("Import files must be 1 MB or smaller.")).toBeVisible();
});
