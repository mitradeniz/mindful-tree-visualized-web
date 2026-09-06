import { expect, test, type Page } from '@playwright/test';
import type { CloudDiagram } from '../../src/auth/cloud-api';

async function mockCloud(page: Page) {
  const diagrams = new Map<number, CloudDiagram>();
  const writes: { method: string; payload: Record<string, unknown> }[] = [];
  let failWrites = false;
  let writeGate: Promise<void> | null = null;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(), url = new URL(request.url());
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (url.pathname.endsWith('/session')) return json({ user: { id: 11, full_name: 'Test User', email: 'test@example.com' } });
    const id = Number(url.pathname.split('/').at(-1));
    if (request.method() === 'GET') return json(id ? { diagram: diagrams.get(id) } : { diagrams: [...diagrams.values()] });
    const payload = request.postDataJSON() as Record<string, unknown>;
    writes.push({ method: request.method(), payload });
    if (writeGate) await writeGate;
    if (failWrites) return json({ error: 'err_service_unavailable' }, 503);
    const diagram = { ...payload, id: id || diagrams.size + 1, revision: Number(payload.revision ?? 0) + 1,
      created_at: '2026-09-04T00:00:00Z', updated_at: '2026-09-04T00:00:00Z' } as CloudDiagram;
    diagrams.set(diagram.id, diagram);
    return json({ diagram }, request.method() === 'POST' ? 201 : 200);
  });
  await page.goto('/app/');
  await expect(page.locator('#account-button')).toHaveAttribute('data-signed-in', 'true');
  return { diagrams, writes, fail: () => { failWrites = true; }, hold: () => {
    let release!: () => void;
    writeGate = new Promise<void>((resolve) => { release = resolve; });
    return () => { writeGate = null; release(); };
  } };
}

async function nameProject(page: Page, title: string) {
  await expect(page.locator('#save-name-panel')).toBeVisible();
  await page.locator('#save-name-input').fill(title);
  await page.locator('#save-name-form button[type="submit"]').click();
  await expect(page.locator('#project-save-state')).toHaveText('Saved to cloud');
}

test('save creates once, updates the current record, saves a copy, and survives reload', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.locator('#cloud-save-button').click();
  await nameProject(page, 'Original');
  await expect(page.locator('#cloud-save-button')).toBeDisabled();
  await page.locator('.cm-content').fill('diagram edited "Edited"\n@view tree\n');
  await page.locator('#cloud-save-button').click();
  await expect.poll(() => cloud.writes.length).toBe(2);
  await expect(page.locator('#project-save-state')).toHaveText('Saved to cloud');
  expect(cloud.writes.map((write) => write.method)).toEqual(['POST', 'PUT']);
  expect(cloud.writes[1]!.payload.title).toBe('Original');
  await page.locator('#save-as-button').click();
  await nameProject(page, 'Copy');
  expect(cloud.diagrams.size).toBe(2);
  // Wait for IndexedDB's local backup before refreshing.
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const r = indexedDB.open('branchscript'); r.onsuccess = () => resolve(r.result); });
    return new Promise<number>((resolve) => { const r = db.transaction('projects').objectStore('projects').get('default'); r.onsuccess = () => { resolve(r.result?.cloudReference?.id ?? 0); db.close(); }; });
  })).toBe(2);
  await page.reload();
  await expect(page.locator('#project-save-state')).toHaveText('Saved to cloud');
  await page.locator('.cm-content').fill('diagram changed "After reload"\n@view tree\n');
  await page.locator('#cloud-save-button').click();
  await expect(page.locator('#project-save-state')).toHaveText('Saved to cloud');
  expect(cloud.writes.at(-1)!.method).toBe('PUT');
  expect(cloud.diagrams.size).toBe(2);
});

test('failed save keeps dirty state and prevents save-and-switch', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.locator('#cloud-save-button').click(); await nameProject(page, 'Original');
  await page.locator('.cm-content').fill('diagram edited "Keep me"\n@view tree\n');
  cloud.fail();
  await page.locator('[data-preset="flow"]').click();
  await page.locator('#confirmation-save').click();
  await expect.poll(() => cloud.writes.length).toBe(2);
  await expect(page.locator('#cloud-save-button')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#confirmation-panel')).toBeVisible();
  await page.locator('#confirmation-cancel').click();
  await expect(page.locator('.cm-content')).toContainText('Keep me');
  await expect(page.locator('#cloud-save-button')).toHaveAttribute('data-dirty', 'true');
});

test('import highlights save as, includes annotations in cloud save and shows profile quota', async ({ page }) => {
  const cloud = await mockCloud(page);
  const source = 'diagram imported "Imported"\n@view tree\n# branchscript-drawing {"id":"test","tool":"line","color":"#149b83","width":3,"points":[{"x":0,"y":0},{"x":20,"y":20}]}\n';
  await page.locator('#file-input').setInputFiles({ name: 'test.mtree', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await expect(page.locator('#save-as-button')).toHaveAttribute('data-dirty', 'true');
  await page.locator('#save-as-button').click(); await nameProject(page, 'Imported copy');
  expect(cloud.writes[0]!.payload.source).toBe(source);
  await page.locator('#profile-button').click();
  await expect(page.locator('#profile-name')).toHaveText('Test User');
  await expect(page.locator('#profile-quota')).toHaveText('1 / 25');
  await page.locator('#profile-close').click();
  await page.locator('[data-preset="flow"]').click();
  await expect(page.locator('#confirmation-panel')).toBeHidden();
});

test('save dialog traps focus and profile fits desktop and mobile', async ({ page }, testInfo) => {
  await mockCloud(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#cloud-save-button').click();
  await expect(page.locator('#save-name-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#save-name-form button[type="submit"]')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('save-dialog.png') });
  await page.keyboard.press('Escape');
  await page.locator('#profile-button').click();
  await page.screenshot({ path: testInfo.outputPath('profile.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#profile-close')).toBeInViewport();
  await page.locator('#profile-close').click();
  await expect(page.locator('#drawing-tool')).toBeInViewport();
  await page.locator('#mobile-project-button').click();
  await expect(page.locator('#mobile-save-as')).toBeInViewport();
  await page.locator('#mobile-save-as').click();
  await expect(page.locator('#save-name-input')).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('mobile-workspace.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('save-and-switch waits for a successful named save', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.locator('.cm-content').fill('diagram pending "Pending"\n@view tree\n');
  await page.locator('[data-preset="flow"]').click();
  await page.locator('#confirmation-save').click();
  await page.locator('#save-name-input').fill('Preserved');
  await page.locator('#save-name-form button[type="submit"]').click();
  await expect(page.locator('#confirmation-panel')).toBeHidden();
  await expect(page.locator('#source-file-name')).toHaveText('idea-to-launch.mtree');
  expect(cloud.diagrams.get(1)!.source).toContain('Pending');
});

test('edits during a pending save remain dirty and cannot be replaced', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.locator('#cloud-save-button').click(); await nameProject(page, 'Original');
  await page.locator('.cm-content').fill('diagram pending "Pending snapshot"\n@view tree\n');
  const release = cloud.hold();
  await page.locator('#cloud-save-button').click();
  await expect.poll(() => cloud.writes.length).toBe(2);
  await page.locator('.cm-content').fill('diagram latest "Newer edit"\n@view tree\n');
  await page.locator('[data-preset="flow"]').click();
  await expect(page.locator('.cm-content')).toContainText('Newer edit');
  release();
  await expect(page.locator('#cloud-save-button')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#cloud-save-button')).toHaveAttribute('data-dirty', 'true');
  expect(cloud.diagrams.get(1)!.source).toContain('Pending snapshot');
});
