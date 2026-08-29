import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nginx = readFileSync("deploy/nginx/default.conf", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");
const compose = readFileSync("compose.yaml", "utf8");
const vite = readFileSync("vite.config.ts", "utf8");
const runtimeStyleHashes = [
  "'sha256-M7OVxilx/0zLfMNXY4uV4vUxjLHBR9ceOhHeoeTEimc='",
  "'sha256-VkxowOVAlzxuSf/1AbtEFLdncjkOHvgEaOPGs9/N+2w='",
  "'sha256-zRr3MHZWdSLA6S7e7RwgGuvkMXplwpky+M34BjMg+CY='",
  "'sha256-XgnsdlP2Xq/ORpXe5zkM4gK0ugr4FNo7yqQgK+KmZQM='",
];

function csp(): string {
  const match = /add_header Content-Security-Policy "([^"]+)" always;/.exec(nginx);
  if (!match?.[1]) throw new Error("Missing Content-Security-Policy header.");
  return match[1];
}

function inlineScriptHashes(path: string): string[] {
  const html = readFileSync(path, "utf8");
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => {
    const digest = createHash("sha256").update(match[1] ?? "").digest("base64");
    return `'sha256-${digest}'`;
  });
}

describe("production security configuration", () => {
  it("keeps a restrictive CSP without inline executable scripts", () => {
    const policy = csp();
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  });

  it("allows only the pinned runtime style modules", () => {
    const styleSource = /(?:^|;\s*)style-src ([^;]+)/.exec(csp())?.[1];
    expect(styleSource).toBeDefined();
    expect(styleSource).not.toContain("'unsafe-inline'");
    for (const hash of runtimeStyleHashes) expect(styleSource).toContain(hash);
  });

  it("allows only the exact structured-data blocks by hash", () => {
    for (const hash of [...inlineScriptHashes("index.html"), ...inlineScriptHashes("faq/index.html")]) {
      expect(csp()).toContain(hash);
    }
  });

  it("sets browser isolation and transport headers", () => {
    for (const header of [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Origin-Agent-Cluster",
    ]) {
      expect(nginx).toContain(`add_header ${header}`);
    }
  });

  it("keeps the runtime container constrained", () => {
    expect(dockerfile).toContain("node:22.23.2-alpine3.24");
    expect(dockerfile).toContain("nginxinc/nginx-unprivileged");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("- ALL");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain("pids_limit:");
    expect(compose).toContain("mem_limit:");
  });

  it("fails closed for API paths and does not publish source maps", () => {
    expect(nginx).toMatch(/location \^~ \/api\/ \{\s*return 404;/);
    expect(vite).toContain("sourcemap: false");
  });
});
