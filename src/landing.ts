import "./styles/privacy.css";
import { t } from "./i18n";
import { mountCookieConsent } from "./privacy/consent";

document.documentElement.dataset.page = "landing";
const footerNavigation = document.querySelector(".site-footer nav");
if (footerNavigation && !footerNavigation.querySelector("[data-cookie-settings]")) {
  const settings = document.createElement("a");
  settings.href = "/privacy/";
  settings.dataset.cookieSettings = "";
  settings.textContent = t("Cookie settings");
  footerNavigation.prepend(settings);
}
mountCookieConsent();
