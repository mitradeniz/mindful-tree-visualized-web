import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

import { build } from "vite";

const rootOutput = new URL("../dist/index.html", import.meta.url);
const projectRoot = process.cwd();
const landingEntry = resolve(projectRoot, "index.html");

async function outputExists() {
  try {
    await access(rootOutput, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await outputExists())) {
  await build({
    configFile: false,
    root: projectRoot,
    input: landingEntry,
    build: {
      emptyOutDir: false,
      outDir: "dist",
      rolldownOptions: {
        input: landingEntry,
      },
      sourcemap: false,
    },
  });
}

if (!(await outputExists())) {
  throw new Error("Vite did not produce dist/index.html");
}
