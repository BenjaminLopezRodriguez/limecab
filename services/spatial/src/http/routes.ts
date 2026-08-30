import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ENTITY_TYPES, type CoverageSummary } from "../contract.ts";
import type { Sql } from "../db.ts";
import { R8, coverageCell } from "../h3/cells.ts";
import { findNearby, placeById, toWirePlace } from "../index/find-nearby.ts";
import type { PlacesProvider } from "../providers/types.ts";

const nearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  query: z.string().min(1).max(256).optional(),
  brandKey: z.string().min(1).max(120).optional(),
  entityTypes: z.array(z.enum(ENTITY_TYPES)).max(10).optional(),
  maxDistanceMeters: z.number().positive().max(50_000).optional(),
  limit: z.number().int().positive().max(100).optional(),
  freshness: z.enum(["any", "default", "strict"]).optional(),
});

const coverageSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const idSchema = z.string().uuid();

export type Context = { sql: Sql; providers: PlacesProvider[] };

export async function route(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Context,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    return send(res, 200, { ok: true });
  }
  if (!authorized(req)) return send(res, 401, { error: "unauthorized" });

  try {
    if (req.method === "POST" && path === "/v1/nearby") {
      const parsed = nearbySchema.safeParse(await readJson(req));
      if (!parsed.success) return send(res, 400, { error: "invalid request" });
      return send(res, 200, await findNearby(ctx.sql, ctx.providers, parsed.data));
    }

    if (req.method === "GET" && path.startsWith("/v1/places/")) {
      const id = idSchema.safeParse(decodeURIComponent(path.slice("/v1/places/".length)));
      if (!id.success) return send(res, 400, { error: "invalid place id" });
      const [place] = await placeById(ctx.sql, id.data);
      if (!place) return send(res, 404, { error: "not found" });
      return send(res, 200, { place: toWirePlace(place) });
    }

    if (req.method === "GET" && path === "/v1/coverage") {
      const parsed = coverageSchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return send(res, 400, { error: "invalid request" });
      return send(res, 200, {
        cells: await coverageFor(ctx.sql, parsed.data.lat, parsed.data.lng),
      });
    }

    return send(res, 404, { error: "not found" });
  } catch (error) {
    console.info("[spatial] request failed", error);
    return send(res, 500, { error: "internal error" });
  }
}

async function coverageFor(
  sql: Sql,
  lat: number,
  lng: number,
): Promise<CoverageSummary[]> {
  const cell = coverageCell(lat, lng);
  const rows = await sql`
    SELECT provider, query_family, h3_index, resolution, coverage_status,
           last_hydrated_at, expires_at, result_count
    FROM cell_coverage
    WHERE h3_index = ${cell} AND resolution = ${R8}
  `;
  return rows.map((row) => ({
    h3Index: row.h3_index as string,
    resolution: row.resolution as number,
    provider: row.provider as CoverageSummary["provider"],
    queryFamily: row.query_family as string,
    status: row.coverage_status as CoverageSummary["status"],
    lastHydratedAt: (row.last_hydrated_at as Date | null)?.toISOString() ?? null,
    expiresAt: (row.expires_at as Date | null)?.toISOString() ?? null,
    resultCount: row.result_count as number,
  }));
}

/** Constant-time: a shared key compared with `===` leaks its prefix. */
export function authorized(req: IncomingMessage): boolean {
  const expected = process.env.SPATIAL_API_KEY;
  const header = req.headers["x-lime-spatial-key"];
  const given = Array.isArray(header) ? header[0] : header;
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const MAX_BODY_BYTES = 64 * 1024;

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
  } catch {
    return null;
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
