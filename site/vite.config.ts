import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The Pages workflow sets SITE_BASE to "/pr-opener". A local build uses the root.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const base = env["SITE_BASE"] ? `${env["SITE_BASE"].replace(/\/$/, "")}/` : "/";
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version: string };

// The site has two documents. The home page runs background.ts, and an iframe runs the options page in its own realm,
// as Chrome does. The deploy adds `status/` and `releases/`.
export default defineConfig({
  base,
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        options: fileURLToPath(new URL("options-frame.html", import.meta.url)),
      },
    },
  },
  define: {
    __BUILD__: JSON.stringify({ sha: (env["GITHUB_SHA"] ?? "local").slice(0, 7), date: new Date().toISOString().slice(0, 10), version: pkg.version }),
  },
});
