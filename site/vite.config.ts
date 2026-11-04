import { fileURLToPath } from "node:url";
import { siteShell } from "@mark1russell7/site-pages/vite";
import { defineConfig } from "vite";

// The site has two documents. The home page runs background.ts, and an iframe runs the options page in its own realm,
// as Chrome does. The deploy adds `status/` and `releases/`.
export default defineConfig({
  plugins: [siteShell({ themeKey: "pr-opener-theme" })],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        options: fileURLToPath(new URL("options-frame.html", import.meta.url)),
      },
    },
  },
});
