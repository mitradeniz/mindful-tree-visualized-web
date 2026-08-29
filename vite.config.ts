import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    license: {
      fileName: "licenses.md",
    },
    sourcemap: false,
    rollupOptions: {
      input: [
        resolve(import.meta.dirname, "index.html"),
        resolve(import.meta.dirname, "app/index.html"),
        resolve(import.meta.dirname, "blog/index.html"),
        resolve(import.meta.dirname, "blog/visual-thinking.html"),
        resolve(import.meta.dirname, "blog/brainstorming-maps.html"),
        resolve(import.meta.dirname, "blog/algorithm-visualization.html"),
        resolve(import.meta.dirname, "faq/index.html"),
      ],
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api/v1/auth/branchscript": "http://127.0.0.1:8080",
      "/api/v1/branchscript": "http://127.0.0.1:8081",
    },
  },
});
