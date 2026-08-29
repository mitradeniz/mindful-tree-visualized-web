import "@antv/x6/dist/index.css";
import "./styles/tokens.css";
import "./styles/app.css";
import { BranchScriptApp } from "./app/branchscript-app";

const root = document.querySelector<HTMLElement>("#app");

if (!root) throw new Error("BranchScript could not find its root element.");

const app = new BranchScriptApp(root);
void app.mount();
