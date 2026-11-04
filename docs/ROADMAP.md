# Roadmap

This file is the plan of pr-opener. The Status page of the site reads it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| P1 | The omnibox keyword | done | The keyword `pull` opens a PR of the first repo with Enter. The dropdown gives one row for each other repo. |
| P2 | The options page | done | The options page adds, removes and moves repos. The first repo is the default, and `chrome.storage.sync` keeps the list. |
| P3 | The site | in progress | The site at https://mark1russell7.github.io/pr-opener/ starts the real `src/background.ts` and `src/options.ts` against a stand-in of the `chrome` APIs. |
| P4 | Escape repo names in descriptions | not started | A suggestion description is XML. A repo name with `&` or `<` gives a description that is not valid XML, so the fix escapes the name. |
| P5 | The build in the install steps | not started | Git does not keep `dist/`, so a new clone needs `pnpm build` before Load unpacked. The README must tell this. |
