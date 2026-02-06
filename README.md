# PR Opener

Chrome extension to quickly open pull requests from the URL bar.

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** ON (top right corner)
3. Click **Load unpacked**
4. Select the `pr-opener` folder

## Usage

1. Type `pull` in the URL bar
2. Press `Tab` (you'll see "PR Opener" activate)
3. Type a PR number (e.g., `123`)
4. Press `Enter` to open the PR

If you have multiple repos configured, use arrow keys to select from the dropdown.

## Configuration

1. Click the puzzle piece icon in Chrome toolbar
2. Find PR Opener → click the 3 dots → "Options"
3. Add/remove repos and reorder them (first repo is the default)
4. Click Save

## Development

```bash
pnpm install
pnpm build       # compile TypeScript
pnpm watch       # compile on changes
```

After making changes, go to `chrome://extensions` and click the refresh icon on the extension.
