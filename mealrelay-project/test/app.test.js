const test = require("node:test");
const assert = require("node:assert/strict");
const { validate, safeStatus } = require("../server");

test("accepts a valid donation and rejects unsafe dates", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const input = { donor: "Canteen", title: "Packed meals", address: "Knowledge Park", portions: 12, category: "cooked", readyAt: future, expiresAt: later, notes: "Sealed" };
  assert.equal(validate(input), null);
  assert.match(validate({ ...input, expiresAt: future, readyAt: later }), /follow ready/);
});

test("expired available posts cannot be claimed", () => {
  assert.equal(safeStatus({ status: "available", expiresAt: "2020-01-01T00:00:00.000Z" }), "expired");
  assert.equal(safeStatus({ status: "claimed", expiresAt: "2020-01-01T00:00:00.000Z" }), "claimed");
});
