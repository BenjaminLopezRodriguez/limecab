import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_APPLE_ID: z.string().optional(),
    AUTH_APPLE_SECRET: z.string().optional(),
    DATABASE_URL: z.string().url(),
    MAPBOX_TOKEN: z.string().optional(),
    /** Places API (New) text search. Server-only. Search degrades to Mapbox without it. */
    GOOGLE_PLACES_API_KEY: z.string().optional(),
    /** Intent parse for colloquial place queries. Heuristic parse without it. */
    DEEPSEEK_API_KEY: z.string().optional(),
    /** Vision classify for Assist photos (AI Gateway API key). */
    AI_GATEWAY_API_KEY: z.string().optional(),
    /**
     * Short-lived Vercel OIDC JWT from `vercel env pull` / deployments.
     * Prefer for local/prod Gateway auth when no API key is set.
     */
    VERCEL_OIDC_TOKEN: z.string().optional(),
    /** Private Vercel Blob store for Assist photo uploads. */
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    /**
     * The spatial place index. Without both, place lookups fall back to the
     * existing Mapbox/Google path.
     */
    SPATIAL_API_URL: z.string().url().optional(),
    SPATIAL_API_KEY: z.string().optional(),
    /** Mint fake drivers and auto-advance trips. Defaults on outside production. */
    SIMULATE_DRIVERS: z.enum(["true", "false"]).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_APPLE_ID: process.env.AUTH_APPLE_ID,
    AUTH_APPLE_SECRET: process.env.AUTH_APPLE_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    SPATIAL_API_URL: process.env.SPATIAL_API_URL,
    SPATIAL_API_KEY: process.env.SPATIAL_API_KEY,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    SIMULATE_DRIVERS: process.env.SIMULATE_DRIVERS,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
