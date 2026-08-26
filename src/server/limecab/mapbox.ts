import { env } from "@/env";

/** Server-side Mapbox token. The public `pk.` token is also valid here. */
export function mapboxToken(): string | undefined {
  return env.MAPBOX_TOKEN ?? env.NEXT_PUBLIC_MAPBOX_TOKEN;
}
