export interface Repo {
  name: string;
  url: string;
}

/** The repos when the storage has none: no repo, so the omnibox asks the user to add one in the options. */
export const DEFAULT_REPOS: Repo[] = [];
