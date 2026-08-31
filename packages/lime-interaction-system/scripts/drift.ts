/**
 * Drift reporter. READ-ONLY against production — never modifies it.
 *
 * Not binary: a SHA mismatch is not inherently bad once production evolves. An UNEXPLAINED
 * one is. Statuses: UNCHANGED | CHANGED_UNREVIEWED | CHANGED_RECONCILED.
 * Mark a reviewed divergence by setting status CHANGED_RECONCILED in SOURCE-MAP.json.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const map = JSON.parse(readFileSync(resolve(here, "../docs/SOURCE-MAP.json"), "utf8")) as {
  modules: Record<string, { source: string; sourceCommit: string; status: string }>;
};

/** Lab projections are presentational forks — not byte-tracked against production SHA. */
const EXEMPT = new Set(["LAB_PROJECTION", "CHANGED_RECONCILED"]);

let drifted = 0;
for (const [labPath, entry] of Object.entries(map.modules)) {
  if (EXEMPT.has(entry.status)) {
    console.log(`${entry.status.padEnd(20)} ${labPath}\n${" ".repeat(21)}${entry.source}`);
    continue;
  }
  const current = execFileSync("git", ["log", "-1", "--format=%H", "--", entry.source], {
    cwd: repoRoot, encoding: "utf8",
  }).trim();
  const changed = current !== entry.sourceCommit;
  const status = !changed ? "UNCHANGED" : "CHANGED_UNREVIEWED";
  if (status === "CHANGED_UNREVIEWED") drifted++;
  console.log(`${status.padEnd(20)} ${labPath}\n${" ".repeat(21)}${entry.source}@${current.slice(0, 8)}`);
}
console.log(`\n${drifted} unreviewed divergence(s).`);
process.exit(drifted > 0 ? 1 : 0);
