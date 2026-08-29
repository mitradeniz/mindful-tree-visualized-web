import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { URL } from "node:url";

import { build } from "vite";

const rootOutput = new URL("../dist/index.html", import.meta.url);

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
    build: {
      emptyOutDir: false,
      outDir: "dist",
      sourcemap: false,
    },
  });
}

if (!(await outputExists())) {
  throw new Error("Vite did not produce dist/index.html");
}
