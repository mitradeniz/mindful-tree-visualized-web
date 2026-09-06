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
  await page.locator('#drawing-tool').selectOption('pen');
  const box = await page.locator('#graph-canvas').boundingBox();
  const x = box!.x + 100, y = box!.y + 210;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 100, y + 30, { steps: 10 }); await page.mouse.up();
  await expect(page.locator('.cm-content')).toContainText('# branchscript-drawing');
  await expect(page.locator('.drawing-layer path')).toHaveCount(1);
  const pathBeforeZoom = await page.locator('.drawing-layer path').getAttribute('d');
  await page.mouse.move(x + 50, y + 15);
  await page.mouse.wheel(0, -500);
  await expect(page.locator('.drawing-layer path')).toHaveAttribute('d', pathBeforeZoom!);
  await page.locator('#drawing-tool').selectOption('rectangle');
  await page.mouse.move(x, y + 70); await page.mouse.down();
  await page.mouse.move(x + 80, y + 150, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('.drawing-layer path')).toHaveCount(2);
  await page.locator('#drawing-undo').click();
  await expect(page.locator('.drawing-layer path')).toHaveCount(1);
  await page.locator('#drawing-tool').selectOption('eraser');
  await page.mouse.click(x + 50, y + 15);
  await expect(page.locator('.drawing-layer path')).toHaveCount(0);
});
