/**
 * The drawn URL bar. It takes the keys of the Chrome omnibox and uses the browser side of the stand-in. It has no logic of
 * the extension: the rows come from the calls of the real `background.ts`.
 */
import { h } from "@mark1russell7/site-pages/chrome";
import { descriptionText, type ChromeStandIn, type Disposition } from "./chrome-stand-in.ts";

/** The elements of the URL bar. */
export interface UrlBarElements {
  readonly box: HTMLElement;
  readonly input: HTMLInputElement;
  readonly chip: HTMLElement;
  readonly list: HTMLElement;
  readonly empty: HTMLElement;
  readonly steps: readonly HTMLElement[];
}

/** The values from `manifest.json` and the page. */
export interface UrlBarOptions {
  readonly keyword: string;
  readonly name: string;
  /** The way that a plain Enter opens the link. */
  readonly disposition: () => Disposition;
}

/** One row of the dropdown. */
interface Row {
  readonly kind: "default" | "suggestion" | "hint";
  readonly content: string;
  readonly text: string;
}

export class UrlBar {
  readonly #standIn: ChromeStandIn;
  readonly #el: UrlBarElements;
  readonly #options: UrlBarOptions;
  #keywordMode = false;
  /** The text of the user in keyword mode. An arrow key shows another text in the input, and this text stays. */
  #typed = "";
  #selected = 0;
  #accepted = false;

  constructor(standIn: ChromeStandIn, elements: UrlBarElements, options: UrlBarOptions) {
    this.#standIn = standIn;
    this.#el = elements;
    this.#options = options;
    const { input, list } = elements;
    input.addEventListener("input", () => this.#onInput());
    input.addEventListener("focus", () => {
      if (!this.#keywordMode) input.select();
    });
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      const key = event.key === "Tab" && event.shiftKey ? "ShiftTab" : event.key;
      if (this.press(key, event.altKey)) event.preventDefault();
    });
    list.addEventListener("click", (event) => this.#onRowClick(event, event.ctrlKey || event.metaKey));
    // A click of the middle button on a row opens a background tab, as in Chrome.
    list.addEventListener("auxclick", (event) => {
      if (event.button === 1) this.#onRowClick(event, true);
    });
    this.render();
  }

  /** This function handles a key. It gives `true` when the key has an effect in the bar. */
  press(key: string, alt = false): boolean {
    switch (key) {
      case "Tab":
      case " ":
        if (!this.#keywordMode && this.#isKeyword()) {
          this.#enterKeyword("");
          return true;
        }
        return key === "Tab" && this.#keywordMode && this.#move(1);
      case "ShiftTab":
        return this.#keywordMode && this.#move(-1);
      case "ArrowDown":
        this.#move(1);
        return true;
      case "ArrowUp":
        this.#move(-1);
        return true;
      case "Enter":
        this.#accept(alt ? "newForegroundTab" : this.#options.disposition());
        return true;
      case "Escape":
        this.#escape();
        return true;
      case "Backspace":
        return this.#onBackspace();
      default:
        return false;
    }
  }

  /** This function writes text into the input as a user does. */
  type(text: string): void {
    this.#el.input.value = text;
    this.#onInput();
  }

  /** The storage changed. Chrome reads it again at the next key, so the page sends the text again for the demo. */
  refresh(): void {
    if (!this.#keywordMode || this.#typed.trim() === "") return;
    this.#standIn.note("The repos changed. This page sends the text again, as the next key in Chrome does.");
    this.#selected = 0;
    this.#el.input.value = this.#typed;
    this.#standIn.changeInput(this.#typed);
  }

  /** The tabs changed: outside keyword mode, the bar shows the URL of the active tab. */
  showActiveTab(): void {
    if (this.#keywordMode) return;
    this.#el.input.value = this.#standIn.tabs.find((tab) => tab.active)?.url ?? "";
    this.render();
  }

  /** This function gives the bar its first state. */
  reset(): void {
    this.#keywordMode = false;
    this.#typed = "";
    this.#selected = 0;
    this.#accepted = false;
    this.#el.input.value = "";
    this.render();
  }

  /** This function draws the state of the bar. */
  render(): void {
    const { box, chip, input, list, empty } = this.#el;
    const rows = this.#rows();
    box.dataset["mode"] = this.#keywordMode ? "keyword" : "text";
    chip.hidden = !this.#keywordMode;
    chip.textContent = this.#options.name;
    list.replaceChildren(...rows.map((row, index) => this.#rowElement(row, index)));
    list.hidden = rows.length === 0;
    empty.hidden = rows.length > 0;
    input.setAttribute("aria-expanded", String(rows.length > 0));
    if (rows.length > 0) input.setAttribute("aria-activedescendant", `row-${this.#selected}`);
    else input.removeAttribute("aria-activedescendant");
    const stage = this.#stage();
    this.#el.steps.forEach((step, index) => {
      step.dataset["state"] = index < stage ? "done" : index === stage ? "current" : "todo";
      if (index === stage) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  #rowElement(row: Row, index: number): HTMLElement {
    const selected = row.kind !== "hint" && index === this.#selected;
    return h(
      "li",
      { id: `row-${index}`, class: `row row-${row.kind}`, role: "option", "aria-selected": String(selected), "data-kind": row.kind, "data-content": row.content, "data-index": index },
      h("span", { class: "row-text" }, row.text),
      row.kind === "hint" ? h("kbd", {}, "Tab") : null,
    );
  }

  #rows(): Row[] {
    if (this.#keywordMode) {
      return [
        { kind: "default", content: this.#typed, text: this.#standIn.defaultText(this.#typed) },
        ...this.#standIn.suggestions.map((suggestion): Row => ({ kind: "suggestion", content: suggestion.content, text: descriptionText(suggestion.description) ?? suggestion.description })),
      ];
    }
    return this.#isKeyword() ? [{ kind: "hint", content: "", text: `${this.#options.keyword}: press Tab to use ${this.#options.name}` }] : [];
  }

  #stage(): number {
    if (this.#accepted) return 4;
    if (!this.#keywordMode) return this.#isKeyword() ? 1 : 0;
    return this.#typed.trim() === "" ? 2 : 3;
  }

  #isKeyword(): boolean {
    return this.#el.input.value.trim().toLowerCase() === this.#options.keyword.toLowerCase();
  }

  #onInput(): void {
    this.#accepted = false;
    const value = this.#el.input.value;
    if (this.#keywordMode) {
      this.#typed = value;
      this.#selected = 0;
      this.#standIn.changeInput(value);
      this.render();
      return;
    }
    // A Space after the keyword starts keyword mode too. A phone keyboard has no Tab key.
    const prefix = `${this.#options.keyword.toLowerCase()} `;
    if (value.toLowerCase().startsWith(prefix)) {
      this.#enterKeyword(value.slice(prefix.length));
      return;
    }
    this.render();
  }

  #enterKeyword(text: string): void {
    this.#accepted = false;
    this.#keywordMode = true;
    this.#typed = text;
    this.#selected = 0;
    this.#el.input.value = text;
    this.#standIn.startInput();
    if (text !== "") this.#standIn.changeInput(text);
    this.render();
  }

  /** This function selects another row. The input shows the `content` of that row, and Chrome fires no event. */
  #move(delta: number): boolean {
    if (!this.#keywordMode) return false;
    const rows = this.#rows();
    const next = this.#selected + delta;
    if (next < 0 || next >= rows.length) return false;
    this.#selected = next;
    this.#el.input.value = rows[next]?.content ?? this.#typed;
    this.render();
    return true;
  }

  #accept(disposition: Disposition): void {
    if (!this.#keywordMode) {
      if (this.#el.input.value.trim() !== "") this.#standIn.note("Chrome sends this text to its search engine, and the extension gets no event. Start with the keyword and Tab.");
      return;
    }
    const text = this.#rows()[this.#selected]?.content ?? this.#typed;
    this.#leaveKeyword();
    this.#accepted = true;
    this.#el.input.value = "";
    this.render();
    this.#standIn.enterInput(text, disposition);
  }

  #escape(): void {
    if (this.#keywordMode) {
      this.#leaveKeyword();
      this.#standIn.cancelInput();
    }
    this.showActiveTab();
  }

  /** Backspace in an empty text leaves keyword mode. The input then has the keyword again, as in Chrome. */
  #onBackspace(): boolean {
    const { input } = this.#el;
    if (!this.#keywordMode || input.value !== "") return false;
    this.#leaveKeyword();
    input.value = this.#options.keyword;
    this.#standIn.cancelInput();
    this.render();
    return true;
  }

  #leaveKeyword(): void {
    this.#keywordMode = false;
    this.#typed = "";
    this.#selected = 0;
  }

  #onRowClick(event: Event, background: boolean): void {
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>(".row") : null;
    if (row === null) return;
    if (row.dataset["kind"] === "hint") {
      this.#enterKeyword("");
      this.#el.input.focus();
      return;
    }
    this.#selected = Number(row.dataset["index"]);
    this.#accept(background ? "newBackgroundTab" : this.#options.disposition());
  }
}
