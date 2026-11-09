import { Repo, DEFAULT_REPOS } from "./types.js";
import { NO_REPO_TEXT, NOT_A_NUMBER_TEXT, START_TEXT, prNumberOf, xmlText } from "./omnibox.js";

// Get configured repos from storage
async function getRepos(): Promise<Repo[]> {
  const result = await chrome.storage.sync.get("repos");
  const repos = result.repos as Repo[] | undefined;
  return repos && repos.length > 0 ? repos : DEFAULT_REPOS;
}

// When user starts typing after "pull ", show suggestions for all repos
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const repos = await getRepos();
  if (!text.trim()) return;

  // Chrome reads each description as XML: a repo name such as "R&D" is escaped, and text that is not a number shows a hint.
  const prNumber = prNumberOf(text);
  const first = repos[0];
  if (prNumber === null || first === undefined) {
    chrome.omnibox.setDefaultSuggestion({ description: first === undefined ? NO_REPO_TEXT : NOT_A_NUMBER_TEXT });
    suggest([]);
    return;
  }

  // Update the default suggestion (shown in omnibox) to show first repo
  chrome.omnibox.setDefaultSuggestion({
    description: `PR #${prNumber} in ${xmlText(first.name)} (Enter) — ↓ for more`,
  });

  // Build suggestions for other repos (shown in dropdown)
  // content format: "prNumber|repoIndex" so we know which repo was selected
  const suggestions = repos.slice(1).map((repo, index) => ({
    content: `${prNumber}|${index + 1}`,
    description: `PR #${prNumber} in ${xmlText(repo.name)}`,
  }));

  suggest(suggestions);
});

// When user presses Enter, navigate to the PR
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const repos = await getRepos();

  // A row of the dropdown has the content "prNumber|repoIndex"; typed text is the PR number for the first repo.
  const [num = "", idx = "0"] = text.split("|");
  const prNumber = prNumberOf(num);
  const repo = repos[parseInt(idx, 10)] ?? repos[0];
  if (prNumber === null || repo === undefined) return;
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
  description: START_TEXT,
});
