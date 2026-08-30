import { z } from "zod";

export interface BranchScriptUser {
  id: number;
  email: string;
  full_name: string;
}

export interface CloudDiagram {
  id: number;
  title: string;
  source: string;
  view: string;
  workspace: {
    direction?: "LR" | "TB" | undefined;
    positions?: Record<string, { x: number; y: number }> | undefined;
    theme?: "light" | "dark" | undefined;
  };
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface CloudDiagramSummary {
  id: number;
  title: string;
  view: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

interface ApiErrorBody {
  error?: string | undefined;
}

const requestTimeoutMs = 15_000;
const maxResponseBytes = 12 * 1024 * 1024;
const maxCloudDiagrams = 25;
const diagramIdSchema = z.number().int().positive();
const nodeIdSchema = z.string().regex(/^[A-Za-z][\w-]*$/).max(80);
const emailSchema = z.string().email().max(254);
const passwordSchema = z.string().min(1).max(72);
const pointSchema = z.object({
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
});
const positionsSchema = z
  .record(nodeIdSchema, pointSchema)
  .refine((positions) => Object.keys(positions).length <= 5_000);
const userSchema = z.object({
  id: z.number().int().positive(),
  email: emailSchema,
  full_name: z.string().max(100),
});
const diagramSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(160),
  source: z.string().max(1_000_000),
  view: z.enum(["tree", "flow", "neural", "logic", "algorithm", "data"]),
  workspace: z.object({
    direction: z.enum(["LR", "TB"]).optional(),
    positions: positionsSchema.optional(),
    theme: z.enum(["light", "dark"]).optional(),
  }),
  revision: z.number().int().nonnegative(),
  created_at: z.string().max(40),
  updated_at: z.string().max(40),
});
const diagramWriteSchema = diagramSchema.pick({ title: true, source: true, view: true, workspace: true });
const diagramUpdateSchema = diagramWriteSchema.extend({ revision: z.number().int().positive() });
const diagramSummarySchema = diagramSchema.pick({ id: true, title: true, view: true, revision: true, created_at: true, updated_at: true });
const diagramListSchema = z
  .array(diagramSummarySchema)
  .max(maxCloudDiagrams);
const apiErrorSchema = z.object({ error: z.string().max(80).optional() });

export class CloudApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    throw new CloudApiError(502, "err_invalid_response");
  }
  if (!response.body) throw new CloudApiError(502, "err_invalid_response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maxResponseBytes) {
      await reader.cancel();
      throw new CloudApiError(502, "err_invalid_response");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CloudApiError(502, "err_invalid_response");
  }
}

function validateInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new CloudApiError(400, "err_invalid_input");
  return parsed.data;
}

async function request<T>(path: string, init: RequestInit = {}, schema?: z.ZodType<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "include",
      // Keep CORS mode even for relative URLs. Firefox serializes the Origin as
      // `null` for non-CORS POST requests when Referrer-Policy is `no-referrer`,
      // which would make the API's strict Origin check correctly reject login
      // and registration requests.
      mode: "cors",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const rawBody = await readJson(response).catch(() => ({}));
      const parsedError = apiErrorSchema.safeParse(rawBody);
      const body: ApiErrorBody = parsedError.success ? parsedError.data : {};
      throw new CloudApiError(response.status, body.error ?? "err_request_failed");
    }
    if (response.status === 204) return undefined as T;
    if (!response.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
      throw new CloudApiError(502, "err_invalid_response");
    }
    const body = await readJson(response);
    if (!schema) return body as T;
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new CloudApiError(502, "err_invalid_response");
    return parsed.data;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function getSession(): Promise<BranchScriptUser | null> {
  try {
    const body = await request("/api/v1/branchscript/session", {}, z.object({ user: userSchema }));
    return body.user;
  } catch (error) {
    if (error instanceof CloudApiError && error.status === 401) return null;
    throw error;
  }
}

export async function register(email: string, password: string, fullName: string): Promise<void> {
  const input = validateInput(
    z.object({ email: emailSchema, password: passwordSchema.min(15), full_name: z.string().max(100) }),
    { email, password, full_name: fullName },
  );
  await request("/api/v1/auth/branchscript/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  const input = validateInput(z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) }), { email, code });
  await request("/api/v1/auth/branchscript/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resendVerification(email: string): Promise<void> {
  const input = validateInput(z.object({ email: emailSchema }), { email });
  await request("/api/v1/auth/branchscript/resend-verification", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(email: string, password: string): Promise<BranchScriptUser> {
  const input = validateInput(z.object({ email: emailSchema, password: passwordSchema }), { email, password });
  const body = await request(
    "/api/v1/auth/branchscript/login",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    z.object({ user: userSchema }),
  );
  return body.user;
}

export async function logout(): Promise<void> {
  await request("/api/v1/branchscript/session", { method: "DELETE" });
}

export async function listDiagrams(): Promise<CloudDiagramSummary[]> {
  const body = await request("/api/v1/branchscript/diagrams", {}, z.object({ diagrams: diagramListSchema }));
  return body.diagrams;
}

export async function getDiagram(id: number): Promise<CloudDiagram> {
  const diagramId = validateInput(diagramIdSchema, id);
  const body = await request(`/api/v1/branchscript/diagrams/${diagramId}`, {}, z.object({ diagram: diagramSchema }));
  return body.diagram;
}

export async function createDiagram(
  diagram: Pick<CloudDiagram, "title" | "source" | "view" | "workspace">,
): Promise<CloudDiagram> {
  const input = validateInput(diagramWriteSchema, diagram);
  const body = await request(
    "/api/v1/branchscript/diagrams",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    z.object({ diagram: diagramSchema }),
  );
  return body.diagram;
}

export async function updateDiagram(diagram: CloudDiagram): Promise<CloudDiagram> {
  // The API deliberately rejects unknown fields. A read response contains id
  // and timestamps, but an update must contain only writable fields plus the
  // optimistic-concurrency revision.
  const input = validateInput(diagramUpdateSchema, {
    title: diagram.title,
    source: diagram.source,
    view: diagram.view,
    workspace: diagram.workspace,
    revision: diagram.revision,
  });
  const body = await request(
    `/api/v1/branchscript/diagrams/${diagram.id}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    z.object({ diagram: diagramSchema }),
  );
  return body.diagram;
}

export async function deleteDiagram(id: number): Promise<void> {
  const diagramId = validateInput(diagramIdSchema, id);
  await request(`/api/v1/branchscript/diagrams/${diagramId}`, { method: "DELETE" });
}

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof CloudApiError)) return "The service is currently unavailable.";
  const message = {
    err_invalid_input: "Check the form fields and try again.",
    err_password_policy: "Use a password between 15 and 72 characters.",
    err_email_exists: "An account already exists for this email.",
    err_not_verified: "Verify your email before signing in.",
    err_user_not_found: "Email or password is incorrect.",
    err_wrong_password: "Email or password is incorrect.",
    err_wrong_code: "The verification code is incorrect.",
    err_code_expired: "The verification code has expired.",
    err_revision_conflict: "This diagram changed elsewhere. Reopen it before saving.",
    err_diagram_limit: "Your cloud library has reached the 25-diagram limit.",
    err_origin_denied: "This request was blocked by the security policy.",
    err_service_unavailable: "Account services are temporarily unavailable.",
    err_already_verified: "This email is already verified. You can sign in.",
    err_resend_cooldown: "Wait a moment before requesting another code.",
  }[error.code];
  if (message) return message;
  if (error.status === 403) return "This request was blocked by the security policy.";
  if (error.status >= 500) return "The service is currently unavailable.";
  return "The request could not be completed.";
}
