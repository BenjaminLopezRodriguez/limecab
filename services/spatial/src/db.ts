import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

export type Sql = postgres.Sql;

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "migrations");

/** Same driver as the main app, so connection behaviour is one thing to know. */
export function createDb(url = process.env.DATABASE_URL): Sql | null {
  if (!url) return null;
  return postgres(url, { max: 8, onnotice: () => {} });
}

/**
 * Every migration is idempotent DDL, so "apply all of them at boot" is the
 * whole runner. No ledger table, no framework, no ordering surprises.
 */
export async function migrate(sql: Sql): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await sql.unsafe(await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
}
