import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const generatedRoot = path.resolve(process.cwd(), "src/generated");
const sharedUtilsPath = path.join(generatedRoot, "utils", "index.ts");

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toRelativeImport(fromDir: string, toFile: string): string {
  let relativePath = toPosix(path.relative(fromDir, toFile));
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
}

function rewriteSpecifier(filePath: string, specifier: string): string {
  if (!specifier.includes("\\") && !specifier.startsWith("~root/")) {
    return specifier;
  }

  const normalized = specifier.replace(/\\/g, "/");
  if (!normalized.startsWith(".") && !normalized.startsWith("~root/")) {
    return normalized;
  }

  const relativeToGenerated = path.relative(generatedRoot, filePath);
  const [packageDir] = relativeToGenerated.split(path.sep);
  if (!packageDir) {
    return normalized;
  }

  const fileDir = path.dirname(filePath);
  const packageRoot = path.join(generatedRoot, packageDir);

  if (normalized.startsWith("~root/")) {
    const targetPath = path.join(packageRoot, normalized.slice("~root/".length));
    return toRelativeImport(fileDir, targetPath);
  }

  if (normalized.endsWith("/utils/index.ts")) {
    return toRelativeImport(fileDir, sharedUtilsPath);
  }

  return normalized;
}

function rewriteImports(source: string, filePath: string): string {
  const replaceSpecifier = (_match: string, prefix: string, specifier: string, suffix: string) =>
    `${prefix}${rewriteSpecifier(filePath, specifier)}${suffix}`;

  return source
    .replace(/(\bfrom\s+['"])([^'"]+)(['"])/g, replaceSpecifier)
    .replace(/(\bimport\s+['"])([^'"]+)(['"])/g, replaceSpecifier);
}

// Hardcoded regexes for each known factory — avoids `new RegExp(dynamicString)` (semgrep ReDoS rule).
const MOVE_STRUCT_FACTORY_PATTERNS: Record<string, RegExp> = {
  VecSet: /(export function VecSet[\s\S]*?\r?\n\]\))(?:: MoveStruct<any(?:, any)?>)? \{/,
  LinkedTable: /(export function LinkedTable[\s\S]*?\r?\n\]\))(?:: MoveStruct<any(?:, any)?>)? \{/,
  Node: /(export function Node[\s\S]*?\r?\n\]\))(?:: MoveStruct<any(?:, any)?>)? \{/,
};

function annotateMoveStructFactory(source: string, functionName: string): string {
  const pattern = MOVE_STRUCT_FACTORY_PATTERNS[functionName];
  if (!pattern) return source;
  return source.replace(pattern, "$1: MoveStruct<any, any> {");
}

function rewritePortableTypes(source: string, filePath: string): string {
  const normalizedPath = toPosix(filePath);

  if (normalizedPath.endsWith("/vec_set.ts")) {
    return annotateMoveStructFactory(source, "VecSet");
  }

  if (normalizedPath.endsWith("/linked_table.ts")) {
    return annotateMoveStructFactory(annotateMoveStructFactory(source, "LinkedTable"), "Node");
  }

  return source;
}

let changedFiles = 0;
for (const filePath of walk(generatedRoot)) {
  const original = readFileSync(filePath, "utf8");
  const rewritten = rewritePortableTypes(rewriteImports(original, filePath), filePath);

  if (rewritten !== original) {
    writeFileSync(filePath, rewritten, "utf8");
    changedFiles += 1;
  }
}

console.log(`Normalized generated import paths in ${changedFiles} file(s).`);
