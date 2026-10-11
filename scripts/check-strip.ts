/**
 * Verifies every source file survives Node's strip-only type stripping.
 *
 * `node --check` is NOT enough: it accepts a TypeScript parameter property that
 * crashes at import time with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX. That exact bug
 * shipped once in this repo (`services/llm/src/provider.ts`), so the check now
 * runs the real transform via `stripTypeScriptTypes`, which parses without
 * executing anything.
 */

import { stripTypeScriptTypes } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Only the code Node loads directly. `apps/web` is compiled by Next's SWC,
 * which performs a full TypeScript transform and accepts enums, parameter
 * properties and JSX - none of which Node's strip-only mode can handle. Running
 * this check there would report failures that are not failures.
 */
const ROOTS = ["contracts", "services", "scripts"];
const SKIP = new Set(["node_modules", ".next", "dist", "out", "coverage", ".git"]);

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // an optional root that does not exist yet
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.m?ts$/.test(entry.name)) yield path; // .tsx is JSX; not Node-loadable
  }
}

const failures: { file: string; message: string }[] = [];
let checked = 0;

for (const root of ROOTS) {
  for await (const file of walk(root)) {
    checked++;
    try {
      stripTypeScriptTypes(await readFile(file, "utf8"), { mode: "strip" });
    } catch (e) {
      failures.push({ file, message: (e as Error).message.split("\n")[0] });
    }
  }
}

if (failures.length > 0) {
  console.error(`\n  ${failures.length} of ${checked} files use syntax Node cannot strip:\n`);
  for (const f of failures) console.error(`    ${f.file}\n      ${f.message}`);
  console.error("");
  process.exit(1);
}

console.log(`${checked} files`);
