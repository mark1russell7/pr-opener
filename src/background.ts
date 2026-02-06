import { Repo, DEFAULT_REPOS } from "./types.js";

// Get configured repos from storage
async function getRepos(): Promise<Repo[]> {
  const result = await chrome.storage.sync.get("repos");
  const repos = result.repos as Repo[] | undefined;
  return repos && repos.length > 0 ? repos : DEFAULT_REPOS;
}

// When user starts typing after "pull ", show suggestions for all repos
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const repos = await getRepos();
  const prNumber = text.trim();

  if (!prNumber) return;

  // Build suggestions for each repo
  // content format: "prNumber|repoIndex" so we know which repo was selected
  const suggestions = repos.map((repo, index) => ({
    content: `${prNumber}|${index}`,
    description: `PR #${prNumber} in ${repo.name}`,
  }));

  // First suggestion becomes the default (shown in omnibox itself)
  // Rest appear in the dropdown
  suggest(suggestions.slice(1));
});

// When user presses Enter, navigate to the PR
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const repos = await getRepos();

  let prNumber: string;
  let repoIndex: number;

  // Check if selection includes repo index (user picked from dropdown)
  if (text.includes("|")) {
    const [num, idx] = text.split("|");
    prNumber = num;
    repoIndex = parseInt(idx, 10);
  } else {
    // Just the PR number - use default (first) repo
    prNumber = text.trim();
    repoIndex = 0;
  }

  const repo = repos[repoIndex] || repos[0];
  const url = repo.url + prNumber;

  // disposition tells us how the user wants to open it
  switch (disposition) {
    case "currentTab":
      chrome.tabs.update({ url });
      break;
    case "newForegroundTab":
      chrome.tabs.create({ url });
      break;
    case "newBackgroundTab":
      chrome.tabs.create({ url, active: false });
      break;
  }
});

// Set the placeholder text shown in the omnibox
chrome.omnibox.setDefaultSuggestion({
  description: "Enter PR number (e.g., 123)",
});
