import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().url().endsWith('/diagrams')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"diagrams":[]}' });
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' });
  });
  await page.goto('/app/');
  // The optional sign-in introduction must not obstruct editing.
  await page.locator('#account-panel-close').click();
});

test('clean templates switch silently; edits prompt and cancel preserves source', async ({ page }) => {
  await page.locator('[data-preset="flow"]').click();
  await expect(page.locator('#confirmation-panel')).toBeHidden();
  await page.locator('#blank-project-button').click();
  await expect(page.locator('#confirmation-panel')).toBeHidden();
  const editor = page.locator('.cm-content');
  await editor.fill('diagram test "Changed"\n@view tree\n');
  await expect(page.locator('#cloud-save-button')).toHaveAttribute('data-dirty', 'true');
  await page.locator('[data-preset="tree"]').click();
  await expect(page.locator('#confirmation-save')).toBeVisible();
  await page.locator('#confirmation-cancel').click();
  await expect(editor).toContainText('Changed');
  await page.locator('[data-preset="tree"]').click();
  await page.locator('#confirmation-accept').click();
  await expect(page.locator('#cloud-save-button')).toHaveAttribute('data-dirty', 'false');
});

test('category entry filters examples including tree and flow', async ({ page }) => {
  await page.locator('[data-preset="flow"]').click();
  await page.locator('#category-examples-button').click();
  await expect(page.locator('[data-template-group="flow"]')).toBeVisible();
  await expect(page.locator('[data-template-group="data"]')).toBeHidden();
});

test('pen and geometry persist in source and undo; eraser removes strokes', async ({ page }) => {
  await page.locator('#blank-project-button').click();
  await page.waitForTimeout(250);
  await page.locator('#drawing-tool').selectOption('pen');
  const box = await page.locator('#graph-canvas').boundingBox();
  const x = box!.x + 100, y = box!.y + 210;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 100, y + 30, { steps: 10 }); await page.mouse.up();
  await expect(page.locator('.cm-content')).toContainText('# branchscript-drawing');
  await expect(page.locator('.drawing-layer path')).toHaveCount(1);
  await page.locator('#drawing-tool').selectOption('eraser');
  await page.mouse.click(x + 50, y + 15);
  await expect(page.locator('.drawing-layer path')).toHaveCount(0);
  await page.locator('#drawing-undo').click();
  await expect(page.locator('.drawing-layer path')).toHaveCount(1);
  await page.locator('#drawing-tool').selectOption('pen');
  const pathBeforeZoom = await page.locator('.drawing-layer path').getAttribute('d');
  const viewBoxBeforeZoom = await page.locator('.drawing-layer').getAttribute('viewBox');
  await page.mouse.move(x + 50, y + 15);
  await page.mouse.wheel(0, -500);
  await expect(page.locator('.drawing-layer path')).toHaveAttribute('d', pathBeforeZoom!);
  await expect(page.locator('.drawing-layer')).not.toHaveAttribute('viewBox', viewBoxBeforeZoom!);
  const drawingBeforeZoom = await page.locator('.drawing-layer path').boundingBox();
  await page.keyboard.down('Control');
  await page.mouse.move(x + 50, y + 15);
  await page.mouse.wheel(0, -500);
  await page.keyboard.up('Control');
  await page.waitForTimeout(80);
  const drawingAfterZoom = await page.locator('.drawing-layer path').boundingBox();
  if (!drawingBeforeZoom || !drawingAfterZoom) throw new Error('Could not measure drawing after zoom');
  expect(drawingAfterZoom.width).toBeGreaterThan(drawingBeforeZoom.width * 1.2);
  expect(drawingAfterZoom.height).toBeGreaterThan(drawingBeforeZoom.height * 1.2);
  await page.locator('#drawing-tool').selectOption('rectangle');
  await page.mouse.move(x, y + 70); await page.mouse.down();
  await page.mouse.move(x + 80, y + 150, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('.drawing-layer path')).toHaveCount(2);
  await page.locator('#drawing-undo').click();
  await expect(page.locator('.drawing-layer path')).toHaveCount(1);
});

test('visual builder drops a shape at the pointer location and keeps it attached to the canvas', async ({ page }) => {
  await page.locator('[data-preset="flow"]').click();
  await page.locator('#add-node-button').click();
  const palette = page.locator('[data-shape-preset="flow-process"]');
  const canvas = page.locator('#graph-canvas');
  const paletteBox = await palette.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!paletteBox || !canvasBox) throw new Error('Could not measure visual builder or canvas');
  const target = { x: canvasBox.x + 320, y: canvasBox.y + 280 };
  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  const node = page.locator('#graph-canvas .x6-node').filter({ hasText: 'Run process' }).last();
  await expect(node).toBeVisible();
  const nodeBox = await node.boundingBox();
  if (!nodeBox) throw new Error('Dropped node has no client bounds');
  expect(Math.abs(nodeBox.x + nodeBox.width / 2 - target.x)).toBeLessThan(12);
  expect(Math.abs(nodeBox.y + nodeBox.height / 2 - target.y)).toBeLessThan(12);
  await page.keyboard.down('Control');
  await page.mouse.move(target.x, target.y);
  await page.mouse.wheel(0, -500);
  await page.keyboard.up('Control');
  await page.waitForTimeout(100);
  const afterZoom = await node.boundingBox();
  if (!afterZoom) throw new Error('Canvas node has no client bounds after zoom');
  expect(afterZoom.width).toBeGreaterThan(nodeBox.width * 1.2);
  expect(afterZoom.height).toBeGreaterThan(nodeBox.height * 1.2);
  const beforePan = afterZoom;
  await page.mouse.move(target.x, target.y);
  await page.mouse.wheel(80, 0);
  await expect.poll(async () => {
    const afterPan = await node.boundingBox();
    return afterPan ? Math.abs(afterPan.x - beforePan.x) : 0;
  }).toBeGreaterThan(50);
  const beforeDrag = await node.boundingBox();
  if (!beforeDrag) throw new Error('Canvas node has no client bounds before drag');
  await page.mouse.move(beforeDrag.x + beforeDrag.width / 2, beforeDrag.y + beforeDrag.height / 2);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + beforeDrag.width / 2 + 80, beforeDrag.y + beforeDrag.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const afterDrag = await node.boundingBox();
  if (!afterDrag) throw new Error('Canvas node has no client bounds after drag');
  expect(Math.abs(afterDrag.x - beforeDrag.x)).toBeGreaterThan(40);
});

test('canvas pans from blank space and nodes remain draggable', async ({ page }) => {
  await page.locator('[data-preset="flow"]').click();
  const canvas = page.locator('#graph-canvas');
  const canvasBox = await canvas.boundingBox();
  const node = page.locator('#graph-canvas .x6-node').first();
  await expect(node).toBeVisible();
  const firstBox = await node.boundingBox();
  if (!canvasBox || !firstBox) throw new Error('Could not measure canvas or node');

  const blank = { x: canvasBox.x + 24, y: canvasBox.y + canvasBox.height - 24 };
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 100, blank.y, { steps: 5 });
  await page.mouse.up();
  const pannedBox = await node.boundingBox();
  if (!pannedBox) throw new Error('Panned node has no client bounds');
  expect(Math.abs(pannedBox.x - firstBox.x)).toBeGreaterThan(60);

  const dragStart = { x: pannedBox.x + pannedBox.width / 2, y: pannedBox.y + pannedBox.height / 2 };
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 80, dragStart.y + 40, { steps: 5 });
  await page.mouse.up();
  const movedBox = await node.boundingBox();
  if (!movedBox) throw new Error('Moved node has no client bounds');
  expect(Math.abs(movedBox.x - pannedBox.x)).toBeGreaterThan(40);
});
