import { expect, test } from "@playwright/test";

test("explains the first diagram, scripting language, examples, and installation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Give structure to every idea." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From a blank canvas to a path you can practice." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A readable script that remains a diagram." })).toBeVisible();
  await expect(page.getByText('question intro "..."', { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start in the browser. Install only if you want to." })).toBeVisible();

  const images = page.locator(".example-gallery img");
  await expect(images).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await images.nth(index).scrollIntoViewIfNeeded();
    await expect(images.nth(index)).toHaveJSProperty("naturalWidth", 1280);
  }
});

test("keeps the landing documentation inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#syntax");

  await expect(page.getByRole("link", { name: "Open playground" })).toBeVisible();
  await expect(page.locator(".syntax-workbench")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const codePanel = page.locator(".syntax-code-panel pre");
  expect(await codePanel.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
