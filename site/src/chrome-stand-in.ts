/**
 * The stand-in of the `chrome` APIs that the extension uses: `chrome.omnibox`, `chrome.storage.sync` and `chrome.tabs`.
 * The real `src/background.ts` and `src/options.ts` call `api`. The URL bar of the page uses the methods of the browser
 * side (`startInput`, `changeInput`, `enterInput`, `cancelInput`), and these fire the events that Chrome fires.
 */
import type { Repo } from "../../src/types.ts";

/** The values of `disposition` that Chrome gives to `onInputEntered`. */
export type Disposition = "currentTab" | "newForegroundTab" | "newBackgroundTab";

/** One row that the extension gives to `suggest`. */
export interface Suggestion {
  readonly content: string;
  readonly description: string;
}

/** The kind of a log entry: Chrome fires an event, a script calls Chrome, a note of the page, or a refused call. */
export type LogKind = "event" | "call" | "note" | "error";

/** One line of the live log. */
export interface LogEntry {
  readonly kind: LogKind;
  readonly from: string;
  readonly api: string;
  readonly detail: string;
}

/** One tab of the drawn browser. */
export interface Tab {
  readonly id: number;
  url: string;
  active: boolean;
  /** The API call that gave the tab its URL. */
  call: string;
}

/** What changed in the stand-in. */
export type Change = "omnibox" | "storage" | "tabs";

/** The functions that show the work of the stand-in. */
export interface StandInHooks {
  readonly onLog: (entry: LogEntry) => void;
  readonly onChange: (change: Change) => void;
}

/** A listener of an event of the stand-in. */
type Listener<Args extends unknown[]> = (...args: Args) => unknown;

/** The callback that `onInputChanged` gives to a listener. */
type Suggest = (suggestions: Suggestion[]) => void;

/** An event of the extension API. A failed listener goes to the log, as Chrome keeps it in the log of the extension. */
export class StandInEvent<Args extends unknown[]> {
  readonly #name: string;
  readonly #log: (entry: LogEntry) => void;
  readonly #listeners = new Set<Listener<Args>>();

  constructor(name: string, log: (entry: LogEntry) => void) {
    this.#name = name;
    this.#log = log;
  }

  addListener(listener: Listener<Args>): void {
    this.#listeners.add(listener);
    this.#log({ kind: "call", from: "background.ts", api: `${this.#name}.addListener`, detail: "(listener)" });
  }

  removeListener(listener: Listener<Args>): void {
    this.#listeners.delete(listener);
  }

  hasListener(listener: Listener<Args>): boolean {
    return this.#listeners.has(listener);
  }

  hasListeners(): boolean {
    return this.#listeners.size > 0;
  }

  /** This function starts each listener. `shown` is the text of the arguments in the log. */
  fire(shown: string, ...args: Args): void {
    const detail = this.#listeners.size === 0 ? `${shown}: the extension has no listener` : shown;
    this.#log({ kind: "event", from: "Chrome", api: this.#name, detail });
    for (const listener of this.#listeners) {
      const failed = (error: unknown): void => {
        this.#log({ kind: "error", from: "background.ts", api: this.#name, detail: `the listener failed: ${error instanceof Error ? error.message : String(error)}` });
      };
      try {
        void Promise.resolve(listener(...args)).catch(failed);
      } catch (error) {
        failed(error);
      }
    }
  }
}

/** This function gives the text of a description. A description is XML, as in the documentation of Chrome. Bad XML gives `undefined`. */
export function descriptionText(description: string): string | undefined {
  const parsed = new DOMParser().parseFromString(`<fragment>${description}</fragment>`, "text/xml");
  if (parsed.querySelector("parsererror") !== null) return undefined;
  return parsed.documentElement.textContent ?? "";
}

/** A value after a trip through the storage: the storage keeps JSON, not the object. */
const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Each storage call ends in a later task, as a call to the browser process does. */
const nextTask = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

/** The text of a value in the log. */
const shown = (value: unknown): string => JSON.stringify(value);

/** The stand-in of `chrome.storage`, for one script. */
export interface StorageApi {
  readonly sync: {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  };
}

/** The `chrome` object of the options page. */
export interface OptionsApi {
  readonly storage: StorageApi;
}

/** The `chrome` object of the background script. */
export interface ChromeApi extends OptionsApi {
  readonly omnibox: {
    readonly onInputStarted: StandInEvent<[]>;
    readonly onInputChanged: StandInEvent<[string, Suggest]>;
    readonly onInputEntered: StandInEvent<[string, Disposition]>;
    readonly onInputCancelled: StandInEvent<[]>;
    setDefaultSuggestion(suggestion: { description: string }): Promise<void>;
  };
  readonly tabs: {
    update(properties: { url: string }): Promise<Tab>;
    create(properties: { url: string; active?: boolean }): Promise<Tab>;
  };
}

/** The browser side of the demo. */
export class ChromeStandIn {
  readonly api: ChromeApi;
  /** The `chrome` object of the options page. */
  readonly optionsApi: OptionsApi;
  /** The tabs of the drawn browser. */
  tabs: Tab[] = [{ id: 1, url: "", active: true, call: "" }];
  /** The rows of the last `suggest` call for the current text. */
  suggestions: readonly Suggestion[] = [];

  readonly #hooks: StandInHooks;
  readonly #store = new Map<string, string>();
  readonly #onInputStarted: StandInEvent<[]>;
  readonly #onInputChanged: StandInEvent<[string, Suggest]>;
  readonly #onInputEntered: StandInEvent<[string, Disposition]>;
  readonly #onInputCancelled: StandInEvent<[]>;
  #defaultDescription = "";
  #inputId = 0;
  #nextTabId = 2;

  constructor(hooks: StandInHooks, repos: readonly Repo[]) {
    this.#hooks = hooks;
    this.#store.set("repos", shown(repos));
    const log = (entry: LogEntry): void => hooks.onLog(entry);
    this.#onInputStarted = new StandInEvent("chrome.omnibox.onInputStarted", log);
    this.#onInputChanged = new StandInEvent("chrome.omnibox.onInputChanged", log);
    this.#onInputEntered = new StandInEvent("chrome.omnibox.onInputEntered", log);
    this.#onInputCancelled = new StandInEvent("chrome.omnibox.onInputCancelled", log);
    this.optionsApi = { storage: this.#storageFor("options.ts") };
    this.api = {
      storage: this.#storageFor("background.ts"),
      omnibox: {
        onInputStarted: this.#onInputStarted,
        onInputChanged: this.#onInputChanged,
        onInputEntered: this.#onInputEntered,
        onInputCancelled: this.#onInputCancelled,
        setDefaultSuggestion: (suggestion) => this.#setDefaultSuggestion(suggestion.description),
      },
      tabs: {
        update: (properties) => this.#updateTab(properties.url),
        create: (properties) => this.#createTab(properties),
      },
    };
  }

  /** This function gives the text of the first row for the text of the user. Chrome puts that text at each `%s`. */
  defaultText(text: string): string {
    return (descriptionText(this.#defaultDescription) ?? "").replaceAll("%s", text);
  }

  /** The value of `repos` in the storage, as the storage keeps it. */
  storedRepos(): unknown {
    const value = this.#store.get("repos");
    return value === undefined ? undefined : (JSON.parse(value) as unknown);
  }

  /** The user enters keyword mode. */
  startInput(): void {
    this.#onInputStarted.fire("()");
  }

  /** The user changes the text in keyword mode. A `suggest` call for an older text does nothing, as in Chrome. */
  changeInput(text: string): void {
    const id = ++this.#inputId;
    this.suggestions = [];
    this.#hooks.onChange("omnibox");
    const suggest: Suggest = (suggestions) => this.#suggest(id, suggestions);
    this.#onInputChanged.fire(`(${shown(text)}, suggest)`, text, suggest);
  }

  /** The user accepts a row. */
  enterInput(text: string, disposition: Disposition): void {
    this.#inputId++;
    this.suggestions = [];
    this.#hooks.onChange("omnibox");
    this.#onInputEntered.fire(`(${shown(text)}, ${shown(disposition)})`, text, disposition);
  }

  /** The user leaves keyword mode with no choice. */
  cancelInput(): void {
    this.#inputId++;
    this.suggestions = [];
    this.#hooks.onChange("omnibox");
    this.#onInputCancelled.fire("()");
  }

  /** The user selects a tab. */
  activateTab(id: number): void {
    for (const tab of this.tabs) tab.active = tab.id === id;
    this.#hooks.onChange("tabs");
  }

  /** This function writes a note of the page into the log. */
  note(detail: string): void {
    this.#hooks.onLog({ kind: "note", from: "This page", api: "note", detail });
  }

  /** This function gives the demo its first state: the repos in the storage, and one empty tab. */
  reset(repos: readonly Repo[]): void {
    this.#inputId++;
    this.suggestions = [];
    this.#store.set("repos", shown(repos));
    this.tabs = [{ id: this.#nextTabId++, url: "", active: true, call: "" }];
    this.#hooks.onChange("storage");
    this.#hooks.onChange("tabs");
    this.#hooks.onChange("omnibox");
  }

  #storageFor(from: string): StorageApi {
    return {
      sync: {
        get: async (key) => {
          const value = this.#store.get(key);
          const result: Record<string, unknown> = value === undefined ? {} : { [key]: JSON.parse(value) as unknown };
          const count = Array.isArray(result[key]) ? `${result[key].length} entries` : "no value";
          this.#hooks.onLog({ kind: "call", from, api: "chrome.storage.sync.get", detail: `(${shown(key)}) gives ${count}` });
          await nextTask();
          return result;
        },
        set: async (items) => {
          this.#hooks.onLog({ kind: "call", from, api: "chrome.storage.sync.set", detail: `(${shown(items)})` });
          const copy = copyOf(items);
          await nextTask();
          for (const [key, value] of Object.entries(copy)) this.#store.set(key, shown(value));
          this.#hooks.onChange("storage");
        },
      },
    };
  }

  #setDefaultSuggestion(description: string): Promise<void> {
    this.#hooks.onLog({ kind: "call", from: "background.ts", api: "chrome.omnibox.setDefaultSuggestion", detail: `(${shown({ description })})` });
    if (descriptionText(description) === undefined) {
      this.#refuse("chrome.omnibox.setDefaultSuggestion", description);
      return Promise.resolve();
    }
    this.#defaultDescription = description;
    this.#hooks.onChange("omnibox");
    return Promise.resolve();
  }

  #suggest(id: number, suggestions: Suggestion[]): void {
    this.#hooks.onLog({ kind: "call", from: "background.ts", api: "suggest", detail: `(${shown(suggestions)})` });
    if (id !== this.#inputId) {
      this.note("Chrome drops this suggest call, because the text changed.");
      return;
    }
    const bad = suggestions.find((suggestion) => descriptionText(suggestion.description) === undefined);
    if (bad !== undefined) {
      this.#refuse("suggest", bad.description);
      return;
    }
    this.suggestions = copyOf(suggestions);
    this.#hooks.onChange("omnibox");
  }

  #refuse(api: string, description: string): void {
    this.#hooks.onLog({ kind: "error", from: "Chrome", api, detail: `refused: a description is XML, and ${shown(description)} is not valid XML` });
  }

  #updateTab(url: string): Promise<Tab> {
    this.#hooks.onLog({ kind: "call", from: "background.ts", api: "chrome.tabs.update", detail: `(${shown({ url })})` });
    const tab = this.tabs.find((candidate) => candidate.active) ?? this.tabs[0]!;
    tab.url = url;
    tab.call = "chrome.tabs.update";
    this.#hooks.onChange("tabs");
    return Promise.resolve({ ...tab });
  }

  #createTab(properties: { url: string; active?: boolean }): Promise<Tab> {
    this.#hooks.onLog({ kind: "call", from: "background.ts", api: "chrome.tabs.create", detail: `(${shown(properties)})` });
    const active = properties.active !== false;
    if (active) for (const tab of this.tabs) tab.active = false;
    const tab: Tab = { id: this.#nextTabId++, url: properties.url, active, call: "chrome.tabs.create" };
    this.tabs.push(tab);
    this.#hooks.onChange("tabs");
    return Promise.resolve({ ...tab });
  }
}
