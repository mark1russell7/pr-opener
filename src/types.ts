export interface Repo {
  name: string;
  url: string;
}

export const DEFAULT_REPOS: Repo[] = [
  { name: "owner/repo", url: "https://github.com/owner/repo/pull/" },
];
