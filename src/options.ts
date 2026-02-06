import { Repo, DEFAULT_REPOS } from "./types.js";

let repos: Repo[] = [];

const repoListEl = document.getElementById("repo-list")!;
const addBtn = document.getElementById("add-btn")!;
const saveBtn = document.getElementById("save-btn")!;
const statusEl = document.getElementById("status")!;

// Load repos from storage
async function loadRepos() {
  const result = await chrome.storage.sync.get("repos");
  const stored = result.repos as Repo[] | undefined;
  repos = stored && stored.length > 0 ? stored : DEFAULT_REPOS;
  render();
}

// Save repos to storage
async function saveRepos() {
  await chrome.storage.sync.set({ repos });
  statusEl.textContent = "Saved!";
  statusEl.className = "status success";
  setTimeout(() => {
    statusEl.className = "status";
  }, 2000);
}

// Render the repo list
function render() {
  repoListEl.innerHTML = "";

  repos.forEach((repo, index) => {
    const item = document.createElement("div");
    item.className = index === 0 ? "repo-item default" : "repo-item";

    item.innerHTML = `
      <input type="text" class="name" value="${escapeHtml(repo.name)}" placeholder="Name" data-index="${index}" data-field="name">
      <input type="text" class="url" value="${escapeHtml(repo.url)}" placeholder="URL (e.g., https://github.com/org/repo/pull/)" data-index="${index}" data-field="url">
      <button class="btn-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
      <button class="btn-down" data-index="${index}" ${index === repos.length - 1 ? "disabled" : ""}>↓</button>
      <button class="btn-delete" data-index="${index}">×</button>
    `;

    repoListEl.appendChild(item);
  });

  // Attach event listeners
  repoListEl.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", handleInputChange);
  });

  repoListEl.querySelectorAll(".btn-up").forEach((btn) => {
    btn.addEventListener("click", handleMoveUp);
  });

  repoListEl.querySelectorAll(".btn-down").forEach((btn) => {
    btn.addEventListener("click", handleMoveDown);
  });

  repoListEl.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", handleDelete);
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function handleInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const index = parseInt(input.dataset.index!, 10);
  const field = input.dataset.field as "name" | "url";
  repos[index][field] = input.value;
}

function handleMoveUp(e: Event) {
  const btn = e.target as HTMLButtonElement;
  const index = parseInt(btn.dataset.index!, 10);
  if (index > 0) {
    [repos[index - 1], repos[index]] = [repos[index], repos[index - 1]];
    render();
  }
}

function handleMoveDown(e: Event) {
  const btn = e.target as HTMLButtonElement;
  const index = parseInt(btn.dataset.index!, 10);
  if (index < repos.length - 1) {
    [repos[index], repos[index + 1]] = [repos[index + 1], repos[index]];
    render();
  }
}

function handleDelete(e: Event) {
  const btn = e.target as HTMLButtonElement;
  const index = parseInt(btn.dataset.index!, 10);
  repos.splice(index, 1);
  render();
}

function handleAdd() {
  repos.push({ name: "", url: "" });
  render();
  // Focus the new name input
  const inputs = repoListEl.querySelectorAll<HTMLInputElement>("input.name");
  inputs[inputs.length - 1]?.focus();
}

// Event listeners
addBtn.addEventListener("click", handleAdd);
saveBtn.addEventListener("click", saveRepos);

// Initial load
loadRepos();
