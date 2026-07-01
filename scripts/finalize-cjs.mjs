// Post-build step for the CommonJS output (`tsconfig.cjs.json` -> `dist/cjs/`).
//
// 1. The root package is `"type": "module"`, so Node would treat the `.js`
//    files under `dist/cjs/` as ESM and choke on their `require()` /
//    `module.exports`. A nested `package.json` with `"type": "commonjs"` makes
//    Node (and bundlers / attw) resolve everything under `dist/cjs/` as
//    CommonJS — which is what the `require` / `default` export conditions point at.
// 2. The CJS transpile pass runs with `noCheck` + `declaration: false` (it can't
//    resolve the deps' modern `exports` maps under `node10`), so it emits no
//    `.d.ts`. The declaration CONTENT is identical for both module formats, so we
//    copy the ESM `.d.ts` tree into `dist/cjs/`; sitting next to the
//    `"type": "commonjs"` marker, those declarations are resolved as CJS types by
//    the `require` condition (fixes publint "types interpreted as ESM" + attw).
import { cpSync, lstatSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distRoot = resolve(import.meta.dirname, "..", "dist");
const cjsRoot = resolve(distRoot, "cjs");

writeFileSync(
  resolve(cjsRoot, "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
);

// Mirror the ESM .d.ts declarations into dist/cjs/src so the `require` condition
// has CJS-flavored types (same content, resolved as CJS via the marker above).
// Recurse into directories; copy only declaration files.
cpSync(resolve(distRoot, "src"), resolve(cjsRoot, "src"), {
  recursive: true,
  filter: (src) => lstatSync(src).isDirectory() || src.endsWith(".d.ts"),
});

console.log(`finalized dist/cjs ({ "type": "commonjs" } + copied .d.ts declarations)`);
