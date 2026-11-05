import assert from "node:assert/strict";
import { test } from "node:test";
import { getWorkNorm, OFFICIAL_CALENDARS } from "../src/lib/work-calendar";
import {
  amount,
  emptyData,
  emptyProfile,
  newEntry,
  validateData,
} from "../src/lib/model";

test("verified monthly calendars agree with the ministry's published annual totals", () => {
  for (const [year, calendar] of Object.entries(OFFICIAL_CALENDARS)) {
    assert.equal(calendar.hours.length, 12);
    assert.equal(
      calendar.hours.reduce((a, b) => a + b, 0),
      calendar.annualHours,
      year,
    );
    assert.ok(calendar.hours.every((hours) => hours > 0 && hours <= 184));
    assert.equal(new URL(calendar.sourceUrl).hostname, "sosial.gov.az");
  }
});
test("March's divisor is year-specific: 111 hours in 2026 and 110 in 2025", () => {
  assert.equal(getWorkNorm("2026-03")?.hours, 111);
  assert.equal(getWorkNorm("2025-03")?.hours, 110);
  const entry = {
    ...newEntry(emptyProfile, "2026-03-10"),
    multiplier: 1 as const,
  };
  assert.equal(
    amount(entry, { "2026-03": { salary: 1200, hours: 160 } }),
    21.62,
  );
  assert.equal(
    amount(
      { ...entry, multiplier: 2 },
      { "2026-03": { salary: 1200, hours: 160 } },
    ),
    43.24,
  );
});
test("legacy manual hours and stale rates cannot override the official salary divisor", () => {
  const entry = {
    ...newEntry(emptyProfile, "2026-03-10"),
    multiplier: 1 as const,
    rate: 7.5,
  };
  const restored = validateData({
    ...emptyData(),
    months: { "2026-03": { salary: 1110, hours: 160 } },
    entries: [entry],
  });
  assert.equal(restored.months["2026-03"].hours, 111);
  assert.equal(restored.entries[0].rate, 7.5);
  assert.equal(amount(restored.entries[0], restored.months), 20);
});
test("unknown years and invalid months are not estimated as official norms", () => {
  assert.equal(getWorkNorm("2027-03"), null);
  assert.equal(getWorkNorm("2026-13"), null);
  assert.equal(getWorkNorm("__proto__"), null);
  assert.equal(
    amount(newEntry(emptyProfile, "2027-03-10"), {
      "2027-03": { salary: 1200, hours: 160 },
    }),
    null,
  );
});
test("an explicitly imported tariff is retained if there is no monthly salary", () => {
  assert.equal(
    amount(
      {
        ...newEntry(emptyProfile, "2026-03-10"),
        multiplier: 1 as const,
        rate: 7.5,
      },
      {},
    ),
    15,
  );
});
