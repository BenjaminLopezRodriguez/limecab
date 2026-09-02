import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveBack } from "../src/harness/back-resolver.ts";
import type { BackContext } from "../src/core/back.ts";
import { sceneId } from "../src/core/index.ts";

const ctx = (over: Partial<BackContext> = {}): BackContext => ({
  frame: { scene: { id: sceneId("test"), surfaces: {} } },
  hasInterrupt: false,
  surfaceHistoryDepth: 0,
  workflowCanRegress: false,
  liveWorkActive: false,
  ...over,
});

test("rider home back is consume (silent no-op)", () => {
  assert.deepEqual(resolveBack("rider", "home", ctx()), { type: "consume" });
});

test("rider live back minimizes before consuming", () => {
  assert.deepEqual(
    resolveBack("rider", "live", ctx({ liveWorkActive: true })),
    { type: "minimize-live-work" },
  );
});

test("freight back returns interrupt when surface history exists", () => {
  assert.deepEqual(
    resolveBack("freight", "draft", ctx({ surfaceHistoryDepth: 1 })),
    { type: "return-interrupt" },
  );
});

const pkgSrc = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

function allTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = resolve(dir, e.name);
    return e.isDirectory() ? allTsFiles(p) : e.name.endsWith(".ts") || e.name.endsWith(".tsx") ? [p] : [];
  });
}

test("package imports no production infrastructure", () => {
  const banned = /@\/server|@\/trpc|drizzle|next-auth|src\/env|DATABASE_URL|@\/env|from\s+["']next\//;
  for (const f of allTsFiles(pkgSrc)) {
    const src = readFileSync(f, "utf8");
    assert.ok(!banned.test(src), `${f} imports forbidden production dependency`);
  }
});

/**
 * A live driver job must survive a generic back gesture. This is the regression the native
 * client exposed: without the live branch, back mid-job resolved to `delegate-to-host` and the
 * host popped the route out from under an accepted trip.
 */
test("driver back minimizes a live job instead of delegating to the host", () => {
  const context: BackContext = {
    frame: { scene: { id: sceneId("driver.enRoute"), surfaces: {} } },
    hasInterrupt: false,
    surfaceHistoryDepth: 0,
    workflowCanRegress: false,
    liveWorkActive: true,
  };
  assert.deepEqual(resolveBack("driver", "live", context), { type: "minimize-live-work" });
  assert.notDeepEqual(resolveBack("driver", "live", context), { type: "delegate-to-host" });
});

test("driver back still hands off to the host when no job is live", () => {
  const context: BackContext = {
    frame: { scene: { id: sceneId("driver.online"), surfaces: {} } },
    hasInterrupt: false,
    surfaceHistoryDepth: 0,
    workflowCanRegress: false,
    liveWorkActive: false,
  };
  assert.deepEqual(resolveBack("driver", "draft", context), { type: "delegate-to-host" });
});
