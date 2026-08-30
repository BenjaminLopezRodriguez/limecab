import type { FindNearbyTelemetry } from "./contract.ts";

/**
 * One line per query, every field of `FindNearbyTelemetry`. Counting
 * `provider_called=false` over total is the whole point: it answers "what
 * share of place searches did we serve without paying Google?".
 */
export function emit(telemetry: FindNearbyTelemetry): void {
  console.info(
    "[spatial]",
    JSON.stringify({
      h3_r9: telemetry.h3R9,
      h3_r8: telemetry.h3R8,
      resolution: telemetry.resolution,
      query_type: telemetry.queryType,
      local_hit: telemetry.localHit,
      coverage_state: telemetry.coverageState,
      provider_called: telemetry.providerCalled,
      provider_requests: telemetry.providerRequests,
      candidates: telemetry.candidates,
      returned: telemetry.returned,
      latency_ms: telemetry.latencyMs,
    }),
  );
}
