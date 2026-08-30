import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSettlementEligible,
  refuseLedgerPostIfSimulated,
  settlementRowFromLoad,
} from "./settlement.ts";

const base = {
  id: "load_1",
  status: "POD_PENDING",
  carrierId: "carrier_1",
  carrierRateMinor: 184_000,
  currency: "USD",
  simulated: true,
};

test("refuseLedgerPostIfSimulated throws for simulated loads", () => {
  assert.throws(
    () => refuseLedgerPostIfSimulated(base),
    /Refusing ledger post for simulated freight load/,
  );
});

test("refuseLedgerPostIfSimulated allows non-simulated", () => {
  assert.doesNotThrow(() =>
    refuseLedgerPostIfSimulated({ ...base, simulated: false }),
  );
});

test("settlementRowFromLoad shape — no ledger fields", () => {
  const row = settlementRowFromLoad(base);
  assert.deepEqual(row, {
    loadId: "load_1",
    carrierId: "carrier_1",
    amountMinor: 184_000,
    currency: "USD",
    simulated: true,
  });
  assert.equal("idempotencyKey" in row, false);
});

test("assertSettlementEligible requires POD + carrier", () => {
  assert.doesNotThrow(() => assertSettlementEligible(base, true));
  assert.throws(() => assertSettlementEligible(base, false));
  assert.throws(() =>
    assertSettlementEligible({ ...base, status: "DELIVERED" }, true),
  );
  assert.throws(() =>
    assertSettlementEligible({ ...base, carrierId: null }, true),
  );
});
