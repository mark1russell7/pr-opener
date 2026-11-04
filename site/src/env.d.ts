import type { OptionsApi } from "./chrome-stand-in.ts";

declare global {
  /** The values of the build, from `vite.config.ts`. */
  const __BUILD__: { readonly sha: string; readonly date: string; readonly version: string };

  interface Window {
    /** The stand-in that the home page gives to the document of the options page. */
    prOpenerOptionsApi?: OptionsApi;
  }
}
