/**
 * The probe of the page. The site check of the Pages workflow starts it in a browser at each width, before the deploy.
 * A failed check stops the deploy.
 *
 * The site check reads this TypeScript file directly. It removes the types and the `export` line, and it starts the result
 * as the body of an async function. So this file has no imports.
 */

// The site check gives these helpers to the probe. Each element of this page is an HTML element.
declare const check: (name: string, ok: unknown, detail?: unknown) => boolean;
declare const until: <T>(fn: () => T | Promise<T>, ms?: number) => Promise<T>;
declare const $: (selector: string) => HTMLElement | null;
declare const $$: (selector: string) => HTMLElement[];
declare const type: (target: string | Element, text: string) => void;
declare const click: (target: string | Element) => void;

const OWNER = "https://github.com/mark1russell7";

const bar = (): HTMLInputElement => $("#omnibox-input") as HTMLInputElement;
const key = (name: string, options: KeyboardEventInit = {}): void => {
  bar().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options }));
};
const rows = (): HTMLElement[] => $$("#omnibox-list .row");
const rowText = (index: number): string => rows()[index]?.querySelector(".row-text")?.textContent ?? "(no row)";
const logLines = (api: string): HTMLElement[] => $$("#log .log-line").filter((line) => line.dataset["api"] === api);
const lastDetail = (api: string): string => logLines(api).at(-1)?.dataset["detail"] ?? "(no line)";
const opened = (): string => $("#opened")?.dataset["url"] ?? "(no element)";
const openedCall = (): string => $("#opened")?.dataset["call"] ?? "(no element)";
const stored = (): { name: string; url: string }[] => (JSON.parse($("#storage")?.textContent ?? "{}") as { repos: { name: string; url: string }[] }).repos;
const mode = (): string => $("#omnibox")?.dataset["mode"] ?? "(no element)";

/** This function starts keyword mode and types a text. It waits for the row of the real listener. */
const search = async (text: string): Promise<void> => {
  key("Escape");
  type(bar(), "pull");
  key("Tab");
  type(bar(), text);
  await until(() => rowText(0).startsWith(`PR #${text.trim()} in `), 2000);
};

/** The document of the real options page, when options.ts has drawn its rows. */
const frameRoot = (): Document | null => ($("#options-frame") as HTMLIFrameElement | null)?.contentDocument ?? null;
const frameDocument = (): Document | null => {
  const doc = frameRoot();
  return doc?.querySelector(".repo-item") ? doc : null;
};
const frameRows = (): number => frameDocument()?.querySelectorAll(".repo-item").length ?? 0;
const frameElement = (selector: string): HTMLElement => frameRoot()?.querySelector<HTMLElement>(selector) as HTMLElement;
const reopen = async (): Promise<void> => {
  const old = $("#options-frame");
  click("#reopen");
  await until(() => $("#options-frame") !== old && frameDocument() !== null);
};

// The start: the real scripts ran against the stand-in.
check("background.ts added its two listeners when it loaded", logLines("chrome.omnibox.onInputChanged.addListener").length === 1 && logLines("chrome.omnibox.onInputEntered.addListener").length === 1, $("#log")?.textContent);
check("background.ts set its first suggestion", lastDetail("chrome.omnibox.setDefaultSuggestion").includes("Enter PR number (e.g., 123)"), lastDetail("chrome.omnibox.setDefaultSuggestion"));
check("the real options.ts reads the storage in the frame", await until(() => frameDocument() !== null, 8000), $("#options-slot")?.innerHTML);
check("the real options page has the title of options.html", frameElement("h1")?.textContent === "PR Opener Settings", frameElement("h1")?.textContent);
check("the options page has one row for each sample repo", frameRows() === 3, frameRows());
check("the first row of the options page is the default", frameElement(".repo-item")?.classList.contains("default"));
check("options.ts writes the first repo into its input", (frameElement("input.name") as HTMLInputElement | undefined)?.value === "mark1russell7/pr-opener");

// The keyword
type(bar(), "pull");
check("the keyword gives the Tab hint", rows()[0]?.dataset["kind"] === "hint" && rowText(0).includes("press Tab"), rowText(0));
check("the keyword alone fires no event", logLines("chrome.omnibox.onInputStarted").length === 0);
key("Tab");
check("Tab starts keyword mode", mode() === "keyword" && !($("#omnibox-chip") as HTMLElement).hidden, mode());
check("the chip has the name of the manifest", $("#omnibox-chip")?.textContent === "PR Opener", $("#omnibox-chip")?.textContent);
check("Tab fires onInputStarted", logLines("chrome.omnibox.onInputStarted").length === 1);
check("the first row is the first suggestion of background.ts", rowText(0) === "Enter PR number (e.g., 123)", rowText(0));

// A number: the rows come from the listener of the real background.ts
type(bar(), "42");
check("the number fires onInputChanged", (await until(() => logLines("chrome.omnibox.onInputChanged").length === 1)) && lastDetail("chrome.omnibox.onInputChanged") === '("42", suggest)', lastDetail("chrome.omnibox.onInputChanged"));
check("the listener reads the repos", await until(() => logLines("chrome.storage.sync.get").some((line) => line.textContent?.includes("background.ts"))), $("#log")?.textContent);
check("the default row names the first repo", await until(() => rowText(0) === "PR #42 in mark1russell7/pr-opener (Enter) — ↓ for more"), rowText(0));
check("the dropdown has one row for each other repo", await until(() => rows().length === 3), rows().length);
check("a row names its repo", rowText(1) === "PR #42 in mark1russell7/client" && rowText(2) === "PR #42 in mark1russell7/vex", rowText(1));
check("a row has the content number|index", rows()[1]?.dataset["content"] === "42|1" && rows()[2]?.dataset["content"] === "42|2", rows()[1]?.dataset["content"]);
const pageBefore = location.href;

// Enter
key("Enter");
check("Enter opens the first repo in this tab", await until(() => opened() === `${OWNER}/pr-opener/pull/42`), opened());
check("Enter fires onInputEntered with currentTab", lastDetail("chrome.omnibox.onInputEntered") === '("42", "currentTab")', lastDetail("chrome.omnibox.onInputEntered"));
check("the extension calls chrome.tabs.update", openedCall() === "chrome.tabs.update" && logLines("chrome.tabs.update").length === 1, openedCall());
const link = $("#opened a") as HTMLAnchorElement | null;
check("the page shows a link and stays open", link?.href === `${OWNER}/pr-opener/pull/42` && link.target === "_blank" && location.href === pageBefore, link?.href);
check("the bar shows the URL of the tab", bar().value === `${OWNER}/pr-opener/pull/42`, bar().value);
check("each of the four steps is done", $$("#steps li").every((step) => step.dataset["state"] === "done"), $("#steps")?.innerHTML);

// The arrow keys and the rows
await search("7");
await until(() => rows().length === 3);
const changesBefore = logLines("chrome.omnibox.onInputChanged").length;
key("ArrowDown");
check("the down arrow shows the content of the row", bar().value === "7|1", bar().value);
check("the down arrow selects the row", rows()[1]?.getAttribute("aria-selected") === "true");
check("the down arrow fires no event", logLines("chrome.omnibox.onInputChanged").length === changesBefore);
key("Enter");
check("Enter on a row opens that repo", await until(() => opened() === `${OWNER}/client/pull/7`), opened());

await search("8");
await until(() => rows().length === 3);
click(rows()[2]!);
check("a click on a row opens that repo", await until(() => opened() === `${OWNER}/vex/pull/8`), opened());

await search("5|1");
key("Enter");
check("a typed number|index goes through the same split", await until(() => opened() === `${OWNER}/client/pull/5`), opened());

// The dispositions
const tabsBefore = $$("#tabs .tab").length;
click('#disposition input[value="newForegroundTab"]');
await search("9");
key("Enter");
check("a new tab uses chrome.tabs.create", await until(() => $$("#tabs .tab").length === tabsBefore + 1) && lastDetail("chrome.tabs.create") === `({"url":"${OWNER}/pr-opener/pull/9"})`, lastDetail("chrome.tabs.create"));
check("the new tab is active", opened() === `${OWNER}/pr-opener/pull/9`, opened());

click('#disposition input[value="newBackgroundTab"]');
await search("10");
key("Enter");
check("a background tab has active false", await until(() => $$("#tabs .tab").length === tabsBefore + 2) && lastDetail("chrome.tabs.create") === `({"url":"${OWNER}/pr-opener/pull/10","active":false})`, lastDetail("chrome.tabs.create"));
check("a background tab leaves the active tab", opened() === `${OWNER}/pr-opener/pull/9`, opened());

click('#disposition input[value="currentTab"]');
await search("11");
key("Enter", { altKey: true });
check("Alt+Enter gives newForegroundTab", await until(() => lastDetail("chrome.omnibox.onInputEntered") === '("11", "newForegroundTab")'), lastDetail("chrome.omnibox.onInputEntered"));

// Esc and Backspace
await search("12");
const cancelsBefore = logLines("chrome.omnibox.onInputCancelled").length;
key("Escape");
check("Esc leaves keyword mode and fires onInputCancelled", mode() === "text" && logLines("chrome.omnibox.onInputCancelled").length === cancelsBefore + 1, mode());
type(bar(), "pull");
key("Tab");
key("Backspace");
check("Backspace in an empty text leaves keyword mode with the keyword", mode() === "text" && bar().value === "pull", bar().value);
key("Escape");

// The real options page changes the suggestions
click(frameElement("#add-btn"));
check("the real Add button adds a row", frameRows() === 4, frameRows());
const lastRow = (): HTMLElement => [...(frameDocument()?.querySelectorAll<HTMLElement>(".repo-item") ?? [])].at(-1) as HTMLElement;
type(lastRow().querySelector("input.name") as Element, "example/made-up");
type(lastRow().querySelector("input.url") as Element, "https://example.com/made-up/pull/");
await search("3");
await until(() => rows().length === 3);
check("a row that is not saved changes no suggestion", rows().length === 3, rows().length);
click(frameElement("#save-btn"));
check("Save writes the new repo to the storage", await until(() => stored().length === 4 && stored()[3]?.name === "example/made-up"), $("#storage")?.textContent);
check("options.ts tells that it saved", frameElement("#status")?.textContent === "Saved!" && frameElement("#status")?.classList.contains("success"), frameElement("#status")?.textContent);
check("the new repo gets a suggestion", await until(() => rows().length === 4 && rowText(3) === "PR #3 in example/made-up"), rowText(3));

click(frameElement(".repo-item .btn-down"));
check("the real down button moves the row", (frameElement("input.name") as HTMLInputElement).value === "mark1russell7/client", (frameElement("input.name") as HTMLInputElement).value);
click(frameElement("#save-btn"));
check("the new first repo becomes the default row", await until(() => rowText(0) === "PR #3 in mark1russell7/client (Enter) — ↓ for more"), rowText(0));

type(frameElement("input.name"), "Not saved");
await reopen();
check("Open again shows the stored list, with no change that is not saved", (frameElement("input.name") as HTMLInputElement).value === "mark1russell7/client", (frameElement("input.name") as HTMLInputElement).value);

// A bad name: Chrome reads a description as XML
type(frameElement("input.name"), "R&D");
click(frameElement("#save-btn"));
check("a name with & gives a refused call in the log", await until(() => $$('#log .log-line[data-kind="error"]').length > 0), $("#log")?.textContent);
check("the refusal names the XML rule", ($$('#log .log-line[data-kind="error"]')[0]?.textContent ?? "").includes("not valid XML"));

// An empty list: the real fallback of src/types.ts
await reopen();
for (let left = frameRows(); left > 0; left--) click(frameElement(".btn-delete"));
click(frameElement("#save-btn"));
check("the storage has an empty list", await until(() => stored().length === 0), $("#storage")?.textContent);
key("Escape");
await search("6");
check("an empty list gives DEFAULT_REPOS of src/types.ts", rowText(0).includes("tulip/tulip"), rowText(0));

// Start again
click("#reset");
check("Start again gives the sample repos", stored().length === 3 && stored()[0]?.name === "mark1russell7/pr-opener", $("#storage")?.textContent);
check("Start again gives one empty tab", $$("#tabs .tab").length === 1 && opened() === "" && bar().value === "", bar().value);
check("Start again opens the options page again", await until(() => frameRows() === 3, 8000), frameRows());

// Show me the four steps
click("#play");
check("the demo button plays the four steps with the real code", await until(() => opened() === `${OWNER}/pr-opener/pull/1`, 8000), opened());

// The theme reaches the real options page
click("#theme");
click("#theme");
const themeOf = (): string | undefined => ($("#options-frame") as HTMLIFrameElement).contentDocument?.documentElement.dataset["theme"];
check("the frame follows the theme of the page", await until(() => themeOf() === document.documentElement.dataset["theme"]), themeOf());
click("#theme");
await until(() => themeOf() === undefined);

// Clipped content: each wide view fits its own box at each width of the check, with its rows on the screen.
await search("1234567890");
await until(() => rows().length === 3);
const views = ["#browser", "#omnibox", "#omnibox-list", "#opened", "#log", "#storage", ".log-card", ".options-card", ".controls", "#steps"];
for (const selector of views) {
  const view = $(selector);
  check(`${selector} fits its box`, view !== null && view.scrollWidth <= view.clientWidth + 1, `${view?.scrollWidth} in ${view?.clientWidth}`);
}
for (const table of $$("table")) {
  const box = table.parentElement as HTMLElement;
  check("a table fits its box", box.scrollWidth <= box.clientWidth + 1, `${box.scrollWidth} in ${box.clientWidth}`);
}
const optionsRoot = ($("#options-frame") as HTMLIFrameElement).contentDocument?.documentElement;
check("the real options page fits its frame", optionsRoot !== undefined && optionsRoot.scrollWidth <= optionsRoot.clientWidth, `${optionsRoot?.scrollWidth} in ${optionsRoot?.clientWidth}`);
const lastInput = [...(frameDocument()?.querySelectorAll("input.url") ?? [])].at(-1);
check("each input of the options page stays in its frame", lastInput !== undefined && lastInput.getBoundingClientRect().right <= (optionsRoot?.clientWidth ?? 0), lastInput?.getBoundingClientRect().right);
const frameBox = $("#options-frame") as HTMLElement;
const body = (frameBox as HTMLIFrameElement).contentDocument?.body;
check("the frame has the height of the options page", await until(() => body !== undefined && body !== null && Math.abs(frameBox.clientHeight - body.offsetHeight) <= 2), `${frameBox.clientHeight} and ${body?.offsetHeight}`);

export {};
