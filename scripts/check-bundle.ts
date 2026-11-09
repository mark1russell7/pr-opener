// This script examines the bundle of the extension after the build.
// Each entry that manifest.json or options.html loads must be one file in dist/, with no import of another file.
// Manifest V3 runs no remote code, and the browser cannot resolve a package name. So a bundle must be whole.
import { existsSync, readFileSync } from "node:fs";

/** The fields of manifest.json that this check reads. */
interface Manifest {
  readonly background: { readonly service_worker: string };
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as Manifest;
const html = readFileSync("options.html", "utf8");

const entries: string[] = [manifest.background.service_worker];
for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
  if (match[1] !== undefined) entries.push(match[1]);
}

const IMPORT = /(?:^|[;\n}])\s*(?:import|export)\s*(?:[\w*{}\s,$]+\s*from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g;

let failures = 0;
for (const entry of entries) {
  if (!entry.startsWith("dist/")) {
    console.error(`${entry}: the entry is not in dist/`);
    failures += 1;
    continue;
  }
  if (!existsSync(entry)) {
    console.error(`${entry}: the file is missing. Start the build first.`);
    failures += 1;
    continue;
  }
  const code = readFileSync(entry, "utf8");
  for (const match of code.matchAll(IMPORT)) {
    console.error(`${entry}: the bundle imports ${match[1] ?? match[2]}`);
    failures += 1;
  }
}

if (failures > 0) process.exit(1);
console.log(`The bundle is whole: ${entries.join(", ")}.`);
