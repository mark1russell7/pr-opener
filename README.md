# PR Opener

Chrome extension to quickly open pull requests from the URL bar.

[Try it on the site](https://mark1russell7.github.io/pr-opener/): the page starts the real extension code in your browser.

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
pnpm build       # bundle src/ into dist/ with esbuild, then check the bundle
pnpm watch       # bundle again on changes
pnpm typecheck   # type check with tsc (no output files)
```

The build bundles each entry (`dist/background.js`, `dist/options.js`) into one file. So the extension can use npm packages: Manifest V3 loads no remote code, and the browser cannot resolve a package name. `scripts/check-bundle.ts` fails the build when an entry of `manifest.json` or `options.html` still imports another file.

After making changes, go to `chrome://extensions` and click the refresh icon on the extension.
