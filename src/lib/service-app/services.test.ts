import test from "node:test";
import assert from "node:assert/strict";

import { formatMoneyMetric } from "./services.ts";

test("money metric stacks dollars over cents", () => {
  assert.deepEqual(formatMoneyMetric(1840), { value: "$18", unit: ".40" });
  assert.deepEqual(formatMoneyMetric(400), { value: "$4", unit: ".00" });
  assert.deepEqual(formatMoneyMetric(0), { value: "$0", unit: ".00" });
});
