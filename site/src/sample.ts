// The start list of the demo: real public repos of the owner. The storage of the stand-in starts with these repos.
import type { Repo } from "../../src/types.ts";

/** The repos in the storage of the stand-in when the page opens. */
export const SAMPLE_REPOS: readonly Repo[] = [
  { name: "mark1russell7/pr-opener", url: "https://github.com/mark1russell7/pr-opener/pull/" },
  { name: "mark1russell7/client", url: "https://github.com/mark1russell7/client/pull/" },
  { name: "mark1russell7/vex", url: "https://github.com/mark1russell7/vex/pull/" },
];
