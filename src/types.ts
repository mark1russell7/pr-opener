export interface Repo {
  name: string;
  url: string;
}

export const DEFAULT_REPOS: Repo[] = [
  { name: "tulip/tulip", url: "https://github.com/tulip/tulip/pull/" },
];
