import "@antv/x6/dist/index.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/privacy.css";
import { BranchScriptApp } from "./app/branchscript-app";
import { mountCookieConsent } from "./privacy/consent";

const root = document.querySelector<HTMLElement>("#app");

if (!root) throw new Error("BranchScript could not find its root element.");

const app = new BranchScriptApp(root);
void app.mount();
mountCookieConsent();
