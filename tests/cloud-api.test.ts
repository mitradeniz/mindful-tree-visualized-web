import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage, CloudApiError, createAdminSession, getAdminStats, getSession, listDiagrams, register } from "../src/auth/cloud-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

describe("cloud API response validation", () => {
  it("accepts a bounded session response with secure fetch options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ user: { id: 7, email: "person@example.com", full_name: "Example Person" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSession()).resolves.toMatchObject({ id: 7, email: "person@example.com" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/branchscript/session",
      expect.objectContaining({ cache: "no-store", credentials: "include", mode: "cors", redirect: "error" }),
    );
  });

  it("validates non-negative integer admin statistics", async () => {
    const response = jsonResponse({ stats: {
      users_total: 10, users_verified: 8, users_pending: 2,
      visitors_total: 20, visitors_today: 3, visitors_7d: 11,
      page_views_total: 42, site_page_views: 18, app_page_views: 24,
      diagrams_total: 16, diagram_owners: 6,
      accounts: [{ id: 7, email: "person@example.com", full_name: "Person", verified: true, created_at: "2026-09-01T10:00:00Z", last_login_at: null, diagram_count: 3 }],
      daily_visits: [{ date: "2026-09-08", visitors: 3, page_views: 5, site_page_views: 2, app_page_views: 3 }],
      countries: [{ country_code: "TR", visitors: 3, page_views: 5 }],
    } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(getAdminStats()).resolves.toMatchObject({ users_total: 10, visitors_today: 3, accounts: [{ diagram_count: 3 }] });
  });

  it("exchanges an admin key without persisting it in browser storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const key = "0123456789abcdef0123456789abcdef";

    await createAdminSession(key);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/branchscript/admin/session",
      expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify({ key }) }),
    );
  });

  it("rejects malformed or excessive backend data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ diagrams: new Array(101).fill({}) })));

    await expect(listDiagrams()).rejects.toMatchObject({
      status: 502,
      code: "err_invalid_response",
    } satisfies Partial<CloudApiError>);
  });

  it("rejects oversized credentials before sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(register("person@example.com", "x".repeat(73), "Person")).rejects.toMatchObject({
      status: 400,
      code: "err_invalid_input",
    } satisfies Partial<CloudApiError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("authentication error messages", () => {
  it("keeps specific account guidance for known errors", () => {
    expect(authErrorMessage(new CloudApiError(403, "err_not_verified"))).toBe(
      "Verify your email before signing in.",
    );
  });

  it("shows safe guidance for brute-force and email-capacity limits", () => {
    expect(authErrorMessage(new CloudApiError(429, "err_too_many_attempts"))).toBe(
      "Too many attempts. Please wait and try again.",
    );
    expect(authErrorMessage(new CloudApiError(429, "err_email_capacity_limited"))).toBe(
      "Email delivery is temporarily limited. Please try again later.",
    );
  });

  it("explains unknown security-policy rejections", () => {
    expect(authErrorMessage(new CloudApiError(403, "err_request_failed"))).toBe(
      "This request was blocked by the security policy.",
    );
  });

  it("does not expose unknown server errors", () => {
    expect(authErrorMessage(new CloudApiError(503, "err_request_failed"))).toBe(
      "The service is currently unavailable.",
    );
  });
});
