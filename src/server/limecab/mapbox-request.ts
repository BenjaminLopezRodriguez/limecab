/**
 * URL-restricted tokens 403 any request without a matching Origin/Referer.
 * Map tiles send one from the browser; server-side Directions/Geocoding do
 * not, unless we forward the page the rider is actually on.
 */
export function mapboxReferer(request: Request): string {
  const origin = request.headers.get("origin")?.trim();
  if (origin) return origin;
  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* fall through to the host */
    }
  }
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.trim();
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** Fetch Mapbox with the rider's origin so URL restrictions pass. */
export function mapboxFetch(
  url: string | URL,
  request: Request,
  init?: RequestInit,
): Promise<Response> {
  const referer = mapboxReferer(request);
  return fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      Referer: referer,
      Origin: referer,
      ...init?.headers,
    },
  });
}
