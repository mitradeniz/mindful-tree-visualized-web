import { expect, test } from "@playwright/test";

test("unlocks statistics with a separate admin key session", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("branchscript-analytics-consent-v1", "rejected"));
  let adminUnlocked = false;
  await page.route("**/api/v1/branchscript/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/branchscript/admin/session" && route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ key: "0123456789abcdef0123456789abcdef" });
      adminUnlocked = true;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/admin/stats")) {
      if (!adminUnlocked) return route.fulfill({ status: 401, json: { error: "err_admin_unauthorized" } });
      return route.fulfill({ status: 200, json: { stats: {
        users_total: 12, users_verified: 10, users_pending: 2,
        visitors_total: 30, visitors_today: 4, visitors_7d: 18,
        page_views_total: 75, site_page_views: 25, app_page_views: 50,
        diagrams_total: 21, diagram_owners: 8,
        accounts: [{ id: 1, email: "person@example.com", full_name: "Person", verified: true, created_at: "2026-09-01T10:00:00Z", last_login_at: "2026-09-08T10:00:00Z", diagram_count: 4 }],
        daily_visits: [{ date: "2026-09-08", visitors: 4, page_views: 7, site_page_views: 2, app_page_views: 5 }],
        countries: [{ country_code: "TR", visitors: 4, page_views: 7 }],
      } } });
    }
    if (path === "/api/v1/branchscript/session") {
      return route.fulfill({ status: 200, json: { user: { id: 1, email: "person@example.com", full_name: "Person" } } });
    }
    return route.fulfill({ status: 200, json: { diagrams: [] } });
  });
  await page.goto("/app/admin/");
  await expect(page.locator("#auth-admin, #profile-admin")).toHaveCount(0);
  await expect(page.locator("#admin-panel")).toBeVisible();
  await page.locator("#admin-login-form input[name=key]").fill("0123456789abcdef0123456789abcdef");
  await page.locator("#admin-login-form button[type=submit]").click();
  await expect(page.locator("#admin-stats")).toContainText("Registered users12");
  await expect(page.locator("#admin-stats")).toContainText("Visitors today4");
  await expect(page.locator("#admin-stats")).toContainText("person@example.com");
  await expect(page.locator("#admin-stats")).toContainText("TR");
});
