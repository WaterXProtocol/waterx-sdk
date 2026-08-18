/**
 * Unit: the docs link checker actually detects rot.
 *
 * Written after the checker shipped with two silent-green bugs — it resolved
 * against `process.cwd()` (so a run from a subdirectory found zero docs and
 * exited 0) and it skipped listed-but-missing docs instead of failing. Both are
 * the kind of defect a checker cannot catch about itself, hence a fixture tree.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkDoc } from "../../../scripts/check-docs-links.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "docs-check-"));
  mkdirSync(path.join(root, "sub"), { recursive: true });
  writeFileSync(path.join(root, "target.md"), "# real\n");
  writeFileSync(path.join(root, "sub", "nested.md"), "# nested\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(rel: string, body: string): string {
  writeFileSync(path.join(root, rel), body);
  return rel;
}

describe("checkDoc", () => {
  it("reports a link whose target does not exist", () => {
    const doc = write("a.md", "see [gone](./nope.md)\n");
    const broken = checkDoc(doc, root);
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({ doc, line: 1, target: "./nope.md" });
  });

  it("accepts a link whose target exists", () => {
    const doc = write("a.md", "see [real](./target.md)\n");
    expect(checkDoc(doc, root)).toEqual([]);
  });

  it("resolves relative to the DOC, not the root", () => {
    // `../target.md` from sub/ is real; the same text from the root is not.
    const nested = write("sub/a.md", "[up](../target.md)\n");
    expect(checkDoc(nested, root)).toEqual([]);
    const top = write("b.md", "[up](../target.md)\n");
    expect(checkDoc(top, root)).toHaveLength(1);
  });

  it("resolves against the root argument, not process.cwd()", () => {
    // The original bug: cwd-relative resolution silently found nothing.
    const doc = write("a.md", "[real](./target.md)\n");
    expect(checkDoc(doc, root)).toEqual([]);
    expect(() => checkDoc(doc, path.join(root, "sub"))).toThrow(); // wrong root must fail loudly
  });

  it("skips external schemes and same-page anchors", () => {
    const doc = write(
      "a.md",
      "[web](https://example.com/nope.md)\n[mail](mailto:x@example.com)\n[anchor](#section)\n",
    );
    expect(checkDoc(doc, root)).toEqual([]);
  });

  it("strips a #fragment before resolving the path", () => {
    const ok = write("a.md", "[line](./target.md#L12)\n");
    expect(checkDoc(ok, root)).toEqual([]);
    const bad = write("b.md", "[line](./nope.md#L12)\n");
    expect(checkDoc(bad, root)).toHaveLength(1);
  });

  it("reports every broken link, with its line number", () => {
    const doc = write("a.md", "[a](./x.md)\n\n[b](./target.md)\n[c](./y.md)\n");
    const broken = checkDoc(doc, root);
    expect(broken.map((b) => b.line)).toEqual([1, 4]);
  });

  it("throws rather than silently skipping a doc that is gone", () => {
    expect(() => checkDoc("never-written.md", root)).toThrow();
  });
});
