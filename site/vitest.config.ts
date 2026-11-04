import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify({ sha: "local", date: "2026-11-03", version: "0.0.0" }),
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
  },
});
