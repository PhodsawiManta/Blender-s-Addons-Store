import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./test/server-only.ts", import.meta.url).pathname
    }
  }
});
