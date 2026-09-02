/**
 * The independence contract, as a runnable check.
 *
 * @lime/ui is only portable for as long as nothing sneaks a renderer or a host application
 * into it, so both facts are asserted rather than trusted: shared components touch no DOM and
 * no forbidden package, and the two platform adapters expose the same surface.
 *
 *   node --experimental-strip-types scripts/contract.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = new URL("../src", import.meta.url).pathname;

/** Everything except the adapters — those are the one place a renderer is allowed. */
const SHARED = ["atoms", "primitives", "tokens", "style"];

const FORBIDDEN_IMPORTS = [
  "react-native",
  "react-dom",
  "@lime/interaction-system",
  "@storybook",
  "storybook",
  "next",
  "next/",
  "@trpc",
  "drizzle",
  "mapbox",
  "react-map-gl",
  "@hugeicons",
  "tailwind",
  "class-variance-authority",
];

const DOM_TAG = /<\/?(div|span|button|input|ul|li|ol|p|a|hr|section|header|footer|nav|img|svg|form|label|h[1-6])[\s/>]/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);
}

const failures: string[] = [];
const shared = SHARED.flatMap((d) => walk(join(root, d)));
assert.ok(shared.length > 0, "found no shared source files — is the layout still src/{atoms,primitives,tokens,style}?");

for (const file of shared) {
  const rel = file.slice(root.length + 1);
  const source = readFileSync(file, "utf8");

  const tag = DOM_TAG.exec(source);
  if (tag) failures.push(`${rel}: renders a DOM tag <${tag[1]}> — use the platform adapter`);

  for (const spec of importsOf(source)) {
    if (spec.startsWith(".")) {
      if (/platform\/(web|native)/.test(spec)) {
        failures.push(`${rel}: imports a platform adapter directly (${spec}) — import "../platform/adapter"`);
      }
      continue;
    }
    if (spec === "react") continue;
    const bad = FORBIDDEN_IMPORTS.find((f) => spec === f || spec.startsWith(`${f}/`) || spec.includes(f));
    failures.push(
      bad
        ? `${rel}: forbidden import "${spec}" — @lime/ui depends on react only`
        : `${rel}: unexpected external import "${spec}" — @lime/ui depends on react only`,
    );
  }
}

// React Native has style keys DOM has never heard of, and React drops an unknown key without
// a word — the padding simply is not there. Anything the shared components use has to be
// translated in the web adapter.
const RN_ONLY_STYLE_KEYS = [
  "paddingHorizontal",
  "paddingVertical",
  "marginHorizontal",
  "marginVertical",
  "paddingStart",
  "paddingEnd",
  "marginStart",
  "marginEnd",
  "textAlignVertical",
  "includeFontPadding",
  "tintColor",
  "resizeMode",
];
const webAdapter = readFileSync(join(root, "platform", "web.tsx"), "utf8");
const usedKeys = new Set(shared.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/(\w+):/g)].map((m) => m[1]!)));
for (const key of RN_ONLY_STYLE_KEYS) {
  if (usedKeys.has(key) && !webAdapter.includes(key)) {
    failures.push(`platform/web.tsx does not translate "${key}" — DOM will drop it silently`);
  }
}

// The adapters are swapped by filename at bundle time, so a name missing from one of them is
// a runtime crash on exactly one platform and invisible everywhere else.
const exported = (file: string) =>
  new Set(
    [...readFileSync(join(root, "platform", file), "utf8").matchAll(/export (?:const|function) (\w+)/g)].map(
      (m) => m[1]!,
    ),
  );
const web = exported("web.tsx");
const native = exported("native.tsx");
for (const name of web) if (!native.has(name)) failures.push(`platform/native.tsx is missing export "${name}"`);
for (const name of native) if (!web.has(name)) failures.push(`platform/web.tsx is missing export "${name}"`);

assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
console.log(`contract ok — ${shared.length} shared files, ${web.size} adapter exports`);
