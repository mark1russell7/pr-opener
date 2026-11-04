// The start of the page. It sets the stand-in on globalThis first, because the real background.ts calls chrome when it loads.
import { byId, copyText, h, setupTheme } from "@mark1russell7/site-pages/chrome";
import "@mark1russell7/site-pages/scroll-cue.css";
import manifest from "../../manifest.json";
import { ChromeStandIn, type Disposition } from "./chrome-stand-in.ts";
import { LogView } from "./log-view.ts";
import { SAMPLE_REPOS } from "./sample.ts";
import { UrlBar } from "./url-bar.ts";
import "./style.css";

setupTheme(byId<HTMLButtonElement>("theme"), "pr-opener-theme");

const log = new LogView(byId("log"), byId("log-count"));
const tabStrip = byId("tabs");
const opened = byId("opened");
const storageView = byId("storage");
const optionsSlot = byId("options-slot");
const dispositionGroup = byId("disposition");
const playButton = byId<HTMLButtonElement>("play");

let bar: UrlBar | undefined;

const standIn = new ChromeStandIn(
  {
    onLog: (entry) => log.add(entry),
    onChange: (change) => {
      if (change === "omnibox") bar?.render();
      if (change === "tabs") {
        drawTabs();
        bar?.showActiveTab();
      }
      if (change === "storage") {
        drawStorage();
        bar?.refresh();
      }
    },
  },
  SAMPLE_REPOS,
);

/** This function gives the short title of a tab, from the path of a pull request URL. */
function tabTitle(url: string): string {
  if (url === "") return "New tab";
  const page = httpUrl(url);
  if (page === undefined) return url;
  const parts = page.pathname.split("/").filter((part) => part !== "");
  const [repo, kind, number] = parts.slice(-3);
  return kind === "pull" && number !== undefined ? `${repo} #${number}` : page.hostname;
}

/** This function parses a URL that a browser tab can show, and gives `undefined` for each other text. */
function httpUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function drawTabs(): void {
  tabStrip.replaceChildren(
    ...standIn.tabs.map((tab) => {
      const button = h("button", { type: "button", class: "tab", "aria-pressed": String(tab.active), "data-url": tab.url, title: tab.url === "" ? "New tab" : tab.url }, tabTitle(tab.url));
      button.addEventListener("click", () => standIn.activateTab(tab.id));
      return button;
    }),
  );
  const active = standIn.tabs.find((tab) => tab.active);
  opened.dataset["url"] = active?.url ?? "";
  opened.dataset["call"] = active?.call ?? "";
  if (active === undefined || active.url === "") {
    opened.replaceChildren(h("p", { class: "opened-empty" }, "This tab is empty. The link that the extension computes shows here."));
    return;
  }
  const page = httpUrl(active.url);
  opened.replaceChildren(
    h("p", { class: "opened-call" }, "The extension called ", h("code", {}, active.call), " with this URL:"),
    page === undefined ? h("p", { class: "opened-url" }, h("code", {}, active.url)) : h("p", { class: "opened-url" }, h("a", { href: page.href, target: "_blank", rel: "noopener noreferrer" }, active.url)),
    h("p", { class: "hint" }, page === undefined ? "This text is not a full URL, so the page shows no link." : "The page does not open this link. Select it to open the pull request in a new tab."),
  );
}

function drawStorage(): void {
  storageView.textContent = JSON.stringify({ repos: standIn.storedRepos() }, null, 2);
}

/** This function opens the options page in a new iframe. The real options.ts starts in that document and reads the storage. */
function openOptions(): void {
  optionsSlot.replaceChildren(h("iframe", { id: "options-frame", src: "options-frame.html", title: "The options page of the extension" }));
}

function disposition(): Disposition {
  return (dispositionGroup.querySelector<HTMLInputElement>("input:checked")?.value ?? "currentTab") as Disposition;
}

Object.defineProperty(globalThis, "chrome", { value: standIn.api, configurable: true, writable: true });
window.prOpenerOptionsApi = standIn.optionsApi;

await import("../../src/background.ts");

const urlBar = new UrlBar(
  standIn,
  {
    box: byId("omnibox"),
    input: byId<HTMLInputElement>("omnibox-input"),
    chip: byId("omnibox-chip"),
    list: byId("omnibox-list"),
    empty: byId("omnibox-empty"),
    steps: [...byId("steps").children] as HTMLElement[],
  },
  { keyword: manifest.omnibox.keyword, name: manifest.name, disposition },
);
bar = urlBar;

drawTabs();
drawStorage();
openOptions();

for (const element of document.querySelectorAll("[data-keyword]")) element.textContent = manifest.omnibox.keyword;

const input = byId<HTMLInputElement>("omnibox-input");

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
  button.addEventListener("click", () => {
    urlBar.press(button.dataset["key"] ?? "");
    input.focus();
  });
}

/** This function plays the four steps with the real keys of the bar. */
async function play(): Promise<void> {
  const pause = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140;
  const wait = (): Promise<void> => new Promise((done) => setTimeout(done, pause));
  playButton.disabled = true;
  urlBar.reset();
  let text = "";
  for (const letter of manifest.omnibox.keyword) {
    text += letter;
    urlBar.type(text);
    await wait();
  }
  await wait();
  urlBar.press("Tab");
  await wait();
  await wait();
  urlBar.type("1");
  await wait();
  await wait();
  await wait();
  urlBar.press("Enter");
  playButton.disabled = false;
}

playButton.addEventListener("click", () => void play());

byId("reset").addEventListener("click", () => {
  log.clear();
  urlBar.reset();
  standIn.reset(SAMPLE_REPOS);
  openOptions();
});

byId("reopen").addEventListener("click", openOptions);
byId("clear-log").addEventListener("click", () => log.clear());

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
  button.addEventListener("click", () => void copyText(button, byId(button.dataset["copy"]!).textContent ?? ""));
}

byId("build").append(
  `Version ${__BUILD__.version}, build `,
  __BUILD__.sha === "local" ? "local" : h("a", { href: `https://github.com/mark1russell7/pr-opener/commit/${__BUILD__.sha}` }, __BUILD__.sha),
  ` of ${__BUILD__.date}`,
);

// A phone opens its keyboard on focus, so only a device with a mouse starts in the bar.
if (matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
