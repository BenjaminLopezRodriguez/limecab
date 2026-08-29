import test from "node:test";
import assert from "node:assert/strict";

import { parseRideUtterance } from "./voice-booking.ts";

test("Take me to LAX in an XL fills the airport and Lime XL", () => {
  const parsed = parseRideUtterance("Take me to LAX in an XL");
  assert.equal(parsed.destinationQuery, "LAX Terminal 4");
  assert.equal(parsed.productHint, "lime-xl");
  assert.ok(parsed.notes.includes("XL"));
});

test("airport cheap lands on LAX and Pool", () => {
  const parsed = parseRideUtterance("airport cheap");
  assert.equal(parsed.destinationQuery, "LAX Terminal 4");
  assert.equal(parsed.productHint, "lime-pool");
});

test("comfort and quiet select Lime Comfort", () => {
  assert.equal(
    parseRideUtterance("Griffith comfort").productHint,
    "lime-comfort",
  );
  assert.equal(
    parseRideUtterance("quiet ride to the pier").destinationQuery,
    "Santa Monica Pier",
  );
  assert.equal(
    parseRideUtterance("quiet ride to the pier").productHint,
    "lime-comfort",
  );
});

test("bags and six people are XL", () => {
  assert.equal(parseRideUtterance("home with bags").productHint, "lime-xl");
  assert.equal(
    parseRideUtterance("work for six people").productHint,
    "lime-xl",
  );
});

test("saved places match Home, Work, Union Station", () => {
  assert.equal(parseRideUtterance("take me home").destinationQuery, "Home");
  assert.equal(parseRideUtterance("to work").destinationQuery, "Work");
  assert.equal(
    parseRideUtterance("union station").destinationQuery,
    "Union Station",
  );
});

test("unknown place does not invent a pin", () => {
  const parsed = parseRideUtterance("somewhere imaginary");
  assert.equal(parsed.destinationQuery, null);
  assert.equal(parsed.productHint, "lime");
});

test("empty utterance is a failed parse", () => {
  const parsed = parseRideUtterance("   ");
  assert.equal(parsed.destinationQuery, null);
});

test("default product is Lime when no preference is spoken", () => {
  const parsed = parseRideUtterance("Dodger Stadium");
  assert.equal(parsed.destinationQuery, "Dodger Stadium");
  assert.equal(parsed.productHint, "lime");
});

test("wait and save fills Wait & Save, not Pool", () => {
  const parsed = parseRideUtterance("Wait & Save to LAX");
  assert.equal(parsed.destinationQuery, "LAX Terminal 4");
  assert.equal(parsed.productHint, "lime-wait-save");
  assert.ok(parsed.notes.includes("Wait & Save"));
  assert.equal(
    parseRideUtterance("take me to the pier wait and save").productHint,
    "lime-wait-save",
  );
});
