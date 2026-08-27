import test from "node:test";
import assert from "node:assert/strict";

import { formatPhone, normalizePhone, phoneEmail } from "./phone.ts";

test("normalizePhone adds US country code to 10-digit numbers", () => {
  assert.equal(normalizePhone("(323) 555-0148"), "13235550148");
  assert.equal(normalizePhone("323-555-0148"), "13235550148");
});

test("normalizePhone keeps an 11-digit 1-prefixed number", () => {
  assert.equal(normalizePhone("+1 323 555 0148"), "13235550148");
});

test("normalizePhone rejects junk", () => {
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("call me"), null);
});

test("formatPhone and phoneEmail round-trip the stored digits", () => {
  assert.equal(formatPhone("13235550148"), "(323) 555-0148");
  assert.equal(phoneEmail("13235550148"), "13235550148@phone.limecab");
});
