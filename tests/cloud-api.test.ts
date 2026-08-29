import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage, CloudApiError, getSession, listDiagrams, register } from "../src/auth/cloud-api";

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
      expect.objectContaining({ cache: "no-store", credentials: "include", mode: "same-origin", redirect: "error" }),
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
