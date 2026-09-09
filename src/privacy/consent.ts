import { t } from "../i18n";

export type AnalyticsConsent = "accepted" | "rejected" | null;

const consentKey = "branchscript-analytics-consent-v1";
const visitorCookie = "branchscript_visitor";
const maxAgeSeconds = 60 * 60 * 24 * 180;

function readConsent(): AnalyticsConsent {
  try {
    const value = window.localStorage.getItem(consentKey);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

function writeConsent(value: Exclude<AnalyticsConsent, null>): void {
  try { window.localStorage.setItem(consentKey, value); } catch { /* Storage may be unavailable. */ }
}

function readVisitorId(): string | null {
  const value = document.cookie.split("; ").find((item) => item.startsWith(`${visitorCookie}=`))?.split("=")[1];
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function deleteVisitorCookie(): void {
  document.cookie = `${visitorCookie}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

function visitorId(): string {
  const existing = readVisitorId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  document.cookie = `${visitorCookie}=${id}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  return id;
}

async function recordVisit(): Promise<void> {
  const page = location.pathname.startsWith("/app") ? "app" : "site";
  try {
    await fetch("/api/v1/branchscript/analytics/visit", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId(), page }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt the product.
  }
}

function banner(): HTMLElement {
  const element = document.createElement("section");
  element.className = "cookie-consent";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-label", t("Cookie preferences"));
  element.innerHTML = `
    <div><strong>${t("Cookie preferences")}</strong><p>${t("We use a necessary secure cookie when you sign in. With your permission, one first-party cookie also counts anonymous visits and the country code supplied by our edge network; the analytics record contains no IP address, browser details, or diagram content.")} <a href="/privacy/">${t("Privacy details")}</a></p></div>
    <div class="cookie-consent-actions"><button type="button" data-cookie-reject>${t("Necessary only")}</button><button type="button" class="cookie-accept" data-cookie-accept>${t("Accept anonymous analytics")}</button></div>`;
  return element;
}

function openPreferences(): void {
  document.querySelector(".cookie-consent")?.remove();
  const element = banner();
  element.querySelector("[data-cookie-accept]")?.addEventListener("click", () => {
    writeConsent("accepted");
    element.remove();
    void recordVisit();
  });
  element.querySelector("[data-cookie-reject]")?.addEventListener("click", () => {
    writeConsent("rejected");
    deleteVisitorCookie();
    element.remove();
  });
  document.body.append(element);
}

export function mountCookieConsent(): void {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-cookie-settings]") : null;
    if (!target) return;
    event.preventDefault();
    openPreferences();
  });
  const consent = readConsent();
  if (consent === "accepted") void recordVisit();
  else if (consent === null) openPreferences();
}
