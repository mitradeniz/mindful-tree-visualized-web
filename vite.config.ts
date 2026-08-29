import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    license: {
      fileName: "licenses.md",
    },
    sourcemap: false,
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
        blog: resolve(import.meta.dirname, "blog/index.html"),
        visualThinking: resolve(import.meta.dirname, "blog/visual-thinking.html"),
        brainstormingMaps: resolve(import.meta.dirname, "blog/brainstorming-maps.html"),
        algorithmVisualization: resolve(import.meta.dirname, "blog/algorithm-visualization.html"),
        faq: resolve(import.meta.dirname, "faq/index.html"),
      },
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
