// The tests of the page. They run the real src/background.ts and src/options.ts against the stand-in, and they run the probe
// of the site check against the page in jsdom. A real browser runs the probe only in the Pages workflow.
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "../../manifest.json";
import { ChromeStandIn, descriptionText, type LogEntry } from "./chrome-stand-in.ts";
import { SAMPLE_REPOS } from "./sample.ts";

/** This function loads a new copy of the real background.ts against a new stand-in. */
async function loadExtension(repos: readonly { name: string; url: string }[] = SAMPLE_REPOS): Promise<{ standIn: ChromeStandIn; log: LogEntry[] }> {
  const log: LogEntry[] = [];
  const standIn = new ChromeStandIn({ onLog: (entry) => log.push(entry), onChange: () => undefined }, repos);
  vi.stubGlobal("chrome", standIn.api);
  vi.resetModules();
  await import("../../src/background.ts");
  return { standIn, log };
}

const calls = (log: readonly LogEntry[], api: string): string[] => log.filter((entry) => entry.api === api).map((entry) => entry.detail);

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("descriptionText", () => {
  it("reads the text of the XML", () => {
    expect(descriptionText("PR <match>#1</match> &amp; more")).toBe("PR #1 & more");
  });

  it("gives undefined for text that is not valid XML", () => {
    expect(descriptionText("PR #1 in R&D")).toBeUndefined();
    expect(descriptionText("a <b")).toBeUndefined();
  });
});

describe("the real background.ts", () => {
  it("adds its listeners and its first suggestion when it loads", async () => {
    const { standIn, log } = await loadExtension();
    expect(calls(log, "chrome.omnibox.onInputChanged.addListener")).toHaveLength(1);
    expect(calls(log, "chrome.omnibox.onInputEntered.addListener")).toHaveLength(1);
    expect(standIn.defaultText("")).toBe("Enter PR number (e.g., 123)");
  });

  it("gives the first repo to the default row and one row to each other repo", async () => {
    const { standIn } = await loadExtension();
    standIn.changeInput("42");
    await vi.waitFor(() => expect(standIn.suggestions).toHaveLength(2));
    expect(standIn.defaultText("42")).toBe("PR #42 in mark1russell7/pr-opener (Enter) — ↓ for more");
    expect(standIn.suggestions.map((row) => row.content)).toEqual(["42|1", "42|2"]);
  });

  it("drops a suggest call for an older text", async () => {
    const { standIn, log } = await loadExtension();
    standIn.changeInput("1");
    standIn.changeInput("2");
    await vi.waitFor(() => expect(standIn.suggestions[0]?.content).toBe("2|1"));
    expect(log.some((entry) => entry.kind === "note" && entry.detail.includes("drops"))).toBe(true);
  });

  it.each([
    ["currentTab", "chrome.tabs.update", '({"url":"https://github.com/mark1russell7/client/pull/5"})'],
    ["newForegroundTab", "chrome.tabs.create", '({"url":"https://github.com/mark1russell7/client/pull/5"})'],
    ["newBackgroundTab", "chrome.tabs.create", '({"url":"https://github.com/mark1russell7/client/pull/5","active":false})'],
  ] as const)("opens %s with %s", async (disposition, api, detail) => {
    const { standIn, log } = await loadExtension();
    standIn.enterInput("5|1", disposition);
    await vi.waitFor(() => expect(calls(log, api)).toEqual([detail]));
  });

  it("uses the first repo for a repo index that does not exist", async () => {
    const { standIn } = await loadExtension();
    standIn.enterInput("5|9", "currentTab");
    await vi.waitFor(() => expect(standIn.tabs[0]?.url).toBe("https://github.com/mark1russell7/pr-opener/pull/5"));
  });

  it("uses DEFAULT_REPOS for an empty list", async () => {
    const { standIn } = await loadExtension([]);
    standIn.changeInput("6");
    await vi.waitFor(() => expect(standIn.defaultText("6")).toContain("owner/repo"));
    expect(standIn.suggestions).toEqual([]);
  });

  it("keeps the old default row when a repo name is not valid XML", async () => {
    const { standIn, log } = await loadExtension([{ name: "R&D", url: "https://example.com/pull/" }]);
    standIn.changeInput("3");
    await vi.waitFor(() => expect(log.some((entry) => entry.kind === "error" && entry.detail.includes("not valid XML"))).toBe(true));
    expect(standIn.defaultText("3")).toBe("Enter PR number (e.g., 123)");
  });
});

describe("the storage of the stand-in", () => {
  it("keeps a copy, not the object", async () => {
    const standIn = new ChromeStandIn({ onLog: () => undefined, onChange: () => undefined }, []);
    const repos = [{ name: "a", url: "b" }];
    await standIn.api.storage.sync.set({ repos });
    repos[0]!.name = "changed";
    expect(standIn.storedRepos()).toEqual([{ name: "a", url: "b" }]);
  });
});

/** This class is the part of ResizeObserver that the options page uses. jsdom has no ResizeObserver. */
class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

/** The helpers of the site check, as its `probeExpression` gives them. `settled` holds a helper while a frame loads. */
function probeHelpers(root: Document, settled: () => Promise<void>): Record<string, unknown> & { results: { name: string; ok: boolean; detail: unknown }[] } {
  const results: { name: string; ok: boolean; detail: unknown }[] = [];
  const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
  const element = (target: string | Element): HTMLElement => {
    const found = typeof target === "string" ? root.querySelector<HTMLElement>(target) : (target as HTMLElement | null);
    if (found === null) throw new Error(`no element: ${String(target)}`);
    return found;
  };
  return {
    results,
    check: (name: string, ok: unknown, detail: unknown) => {
      results.push({ name, ok: !!ok, detail });
      return !!ok;
    },
    until: async <T>(fn: () => T | Promise<T>, ms = 5000): Promise<T> => {
      const end = Date.now() + ms;
      for (;;) {
        await wait(0);
        await settled();
        const value = await fn();
        if (value || Date.now() > end) return value;
        await wait(10);
      }
    },
    $: (selector: string) => root.querySelector(selector),
    $$: (selector: string) => [...root.querySelectorAll(selector)],
    type: (target: string | Element, text: string) => {
      const input = element(target) as HTMLInputElement;
      input.focus();
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    click: (target: string | Element) => element(target).click(),
  };
}

/**
 * This function starts `options-frame.ts` in the document of an iframe. jsdom loads no iframe, so the test gives the module that
 * document for the time of the import. The stand-in stays the `chrome` of the main script after the import.
 */
async function loadFrame(frame: HTMLIFrameElement, home: Document): Promise<void> {
  const doc = frame.contentDocument as Document;
  if (doc.documentElement === null) doc.appendChild(doc.importNode(doc.implementation.createHTMLDocument("").documentElement, true));
  const main = (globalThis as unknown as { chrome: unknown }).chrome;
  vi.stubGlobal("parent", { prOpenerOptionsApi: window.prOpenerOptionsApi, document: home });
  vi.stubGlobal("document", doc);
  vi.resetModules();
  try {
    await import("./options-frame.ts");
  } finally {
    vi.stubGlobal("document", home);
    Object.defineProperty(globalThis, "chrome", { value: main, configurable: true, writable: true });
  }
}

describe("the probe of the site check", () => {
  const probe = readFileSync("src/check-probe.ts", "utf8");

  it("has no imports, and the site check can remove its types", () => {
    const script = stripTypeScriptTypes(probe, { mode: "strip" });
    expect(script).not.toMatch(/^\s*import\s/m);
    expect(script).not.toMatch(/\b(?:startsWith|includes)\("https?:/);
  });

  it("has at least 15 steps", () => {
    expect(probe.match(/^\s*check\(/gm)?.length ?? 0).toBeGreaterThanOrEqual(15);
  });

  describe("on the page", () => {
    beforeEach(() => {
      const html = readFileSync("index.html", "utf8");
      document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, "") ?? "";
      vi.stubGlobal("ResizeObserver", StubObserver);
      vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion") }));
    });

    it("passes each check", async () => {
      const home = document;
      let loading: Promise<void> = Promise.resolve();
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLIFrameElement) loading = loading.then(() => loadFrame(node, home));
          }
        }
      }).observe(home.getElementById("options-slot") as HTMLElement, { childList: true });

      vi.resetModules();
      await import("./main.ts");

      const helpers = probeHelpers(home, () => loading);
      const { results, ...given } = helpers;
      const script = stripTypeScriptTypes(probe, { mode: "strip" }).replace(/^export \{\s*\};?[ \t]*$/m, "");
      const AsyncFunction = (async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
      await new AsyncFunction(...Object.keys(given), script)(...Object.values(given));

      expect(results.filter((result) => !result.ok)).toEqual([]);
      expect(results.length).toBeGreaterThanOrEqual(15);
    }, 30000);
  });
});

describe("the files of the site", () => {
  it("reads the keyword from the manifest", () => {
    expect(manifest.omnibox.keyword).toBe("pull");
  });
});
