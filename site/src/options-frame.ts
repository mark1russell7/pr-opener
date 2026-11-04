// The document of the options page. It has the body of the real options.html, the real options.css and the real options.ts.
// It is an iframe, so options.ts has its own realm, as an extension page has in Chrome.
import optionsHtml from "../../options.html?raw";
import "../../options.css";
import "./options-frame.css";

const home = window.parent;
const api = home.prOpenerOptionsApi;

if (api === undefined) {
  // This document has no stand-in when a visitor opens it alone.
  location.replace("./");
} else {
  const source = new DOMParser().parseFromString(optionsHtml, "text/html");
  source.querySelectorAll("script, link").forEach((element) => element.remove());
  document.body.replaceChildren(...source.body.childNodes);

  Object.defineProperty(globalThis, "chrome", { value: api, configurable: true, writable: true });
  await import("../../src/options.ts");

  const root = document.documentElement;
  const homeRoot = home.document.documentElement;
  const followTheme = (): void => {
    const theme = homeRoot.dataset["theme"];
    if (theme === undefined) delete root.dataset["theme"];
    else root.dataset["theme"] = theme;
  };
  followTheme();
  new MutationObserver(followTheme).observe(homeRoot, { attributes: true, attributeFilter: ["data-theme"] });

  // The iframe takes the height of its content, so the page has one scroller.
  const frame = window.frameElement as HTMLIFrameElement | null;
  if (frame !== null) {
    const fit = (): void => {
      frame.style.height = `${document.body.offsetHeight}px`;
    };
    new ResizeObserver(fit).observe(document.body);
    fit();
  }
}
