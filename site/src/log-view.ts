// The live log: each event that Chrome fires and each call that the scripts of the extension make.
import { h } from "@mark1russell7/site-pages/chrome";
import type { LogEntry, LogKind } from "./chrome-stand-in.ts";

/** The most lines that the log keeps. */
const LIMIT = 300;

/** The word in front of a line. */
const LABEL: Readonly<Record<LogKind, string>> = { event: "fires", call: "calls", note: "note", error: "refused" };

export class LogView {
  readonly #list: HTMLElement;
  readonly #count: HTMLElement;
  #next = 1;

  constructor(list: HTMLElement, count: HTMLElement) {
    this.#list = list;
    this.#count = count;
  }

  add(entry: LogEntry): void {
    const list = this.#list;
    const follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    const number = this.#next++;
    list.append(
      h(
        "li",
        { class: `log-line log-${entry.kind}`, "data-kind": entry.kind, "data-api": entry.api, "data-detail": entry.detail },
        h("span", { class: "log-n" }, String(number)),
        h("span", { class: "log-who" }, `${entry.from} ${LABEL[entry.kind]}`),
        entry.kind === "note" ? null : h("code", { class: "log-api" }, entry.api),
        h("code", { class: "log-detail" }, entry.detail),
      ),
    );
    while (list.childElementCount > LIMIT) list.firstElementChild?.remove();
    if (follow) list.scrollTop = list.scrollHeight;
    this.#count.textContent = `${number} ${number === 1 ? "line" : "lines"}`;
  }

  clear(): void {
    this.#list.replaceChildren();
    this.#next = 1;
    this.#count.textContent = "0 lines";
  }
}
