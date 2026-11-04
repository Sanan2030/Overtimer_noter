import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amount,
  durationMinutes,
  emptyData,
  emptyProfile,
  formatDuration,
  isDate,
  mergeData,
  money,
  newEntry,
  overlaps,
  validateData,
} from "../src/lib/model";

const entry = (overrides: Partial<ReturnType<typeof newEntry>> = {}) => ({
  ...newEntry(emptyProfile, "2026-10-02"),
  ...overrides,
});

test("monthly net salary, minutes and each multiplier calculate correctly", () => {
  const months = { "2026-10": { salary: 1200, hours: 160 } };
  for (const multiplier of [1, 2, 3] as const)
    assert.equal(
      amount(entry({ end: "19:30", multiplier }), months),
      11.25 * multiplier,
    );
});
test("overnight shifts deduct breaks and retain their start month", () => {
  const row = entry({
    date: "2026-10-31",
    start: "22:00",
    end: "02:00",
    breakMinutes: 30,
    multiplier: 2,
  });
  assert.equal(durationMinutes(row), 210);
  assert.equal(
    amount(row, {
      "2026-10": { salary: 1200, hours: 160 },
      "2026-11": { salary: 2400, hours: 160 },
    }),
    52.5,
  );
  assert.equal(formatDuration(210), "03:30");
});
test("missing rates remain unpriced, zero salary remains a valid rate", () => {
  assert.equal(amount(entry(), {}), null);
  assert.equal(amount(entry(), { "2026-10": { salary: 0, hours: 160 } }), 0);
});
test("snapshot rates take precedence over later monthly changes", () => {
  assert.equal(
    amount(entry({ rate: 10 }), { "2026-10": { salary: 1200, hours: 160 } }),
    20,
  );
});
test("equal times, malformed times and excessive breaks fail", () => {
  assert.throws(() => durationMinutes(entry({ start: "18:00", end: "18:00" })));
  assert.throws(() => durationMinutes(entry({ start: "25:00" })));
  assert.throws(() => durationMinutes(entry({ breakMinutes: 120 })));
  assert.throws(() => durationMinutes(entry({ breakMinutes: -1 })));
  assert.throws(() => durationMinutes(entry({ breakMinutes: 0.5 })));
});
test("real dates including leap years are validated", () => {
  assert.equal(isDate("2024-02-29"), true);
  assert.equal(isDate("2026-02-29"), false);
  assert.equal(isDate("2026-13-01"), false);
});
test("overlap detection crosses midnight and ignores adjacent/different employees", () => {
  const first = entry({
    date: "2026-10-02",
    start: "22:00",
    end: "02:00",
    employee: "İnci",
  });
  assert.equal(
    overlaps(
      entry({
        date: "2026-10-03",
        start: "01:00",
        end: "03:00",
        employee: "İnci",
      }),
      [first],
    ),
    true,
  );
  assert.equal(
    overlaps(
      entry({
        date: "2026-10-03",
        start: "02:00",
        end: "03:00",
        employee: "İnci",
      }),
      [first],
    ),
    false,
  );
  assert.equal(
    overlaps(
      entry({
        date: "2026-10-03",
        start: "01:00",
        end: "03:00",
        employee: "Emin",
      }),
      [first],
    ),
    false,
  );
  assert.equal(overlaps(first, [first]), false);
});
test("JSON validation rejects invalid amounts, prototype month keys and duplicate ids", () => {
  assert.throws(() =>
    validateData({ ...emptyData(), entries: [entry({ rate: -1 })] }),
  );
  assert.throws(() =>
    validateData({
      ...emptyData(),
      months: JSON.parse('{"__proto__":{"salary":1000,"hours":160}}'),
    }),
  );
  const row = entry();
  assert.throws(() => validateData({ ...emptyData(), entries: [row, row] }));
  assert.throws(() =>
    validateData({
      ...emptyData(),
      months: { "2026-10": { salary: 1000, hours: 0 } },
    }),
  );
  assert.throws(() =>
    validateData({ ...emptyData(), entries: [{ ...row, multiplier: 4 }] }),
  );
});
test("merge is repeatable, retains current settings and freezes imported rates", () => {
  const current = {
    ...emptyData(),
    months: { "2026-10": { salary: 1200, hours: 160 } },
  };
  const imported = {
    ...emptyData(),
    months: { "2026-10": { salary: 1600, hours: 160 } },
    entries: [entry()],
  };
  const first = mergeData(current, imported);
  assert.equal(first.added, 1);
  assert.equal(first.data.months["2026-10"].salary, 1200);
  assert.equal(first.data.entries[0].rate, 10);
  const second = mergeData(first.data, imported);
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 1);
});
test("merge replaces conflicting ids without losing distinct records", () => {
  const first = entry();
  const merged = mergeData(
    { ...emptyData(), entries: [first] },
    { ...emptyData(), entries: [{ ...first, subject: "Digər iş" }] },
  );
  assert.equal(merged.data.entries.length, 2);
  assert.notEqual(merged.data.entries[0].id, merged.data.entries[1].id);
});
test("calculation rounds money only after multiplying full precision rate", () => {
  assert.equal(
    amount(entry({ end: "18:01", multiplier: 3 }), {
      "2026-10": { salary: 1234, hours: 168 },
    }),
    0.37,
  );
});
test("money always uses the Azerbaijani decimal separator", () => {
  assert.equal(money(15), "15,00");
  assert.equal(money(1234.5), "1\u00a0234,50");
});
test("reimporting an unpriced source skips rows already assigned a rate", () => {
  const imported = entry();
  const current = { ...emptyData(), entries: [{ ...imported, rate: 7.5 }] };
  assert.equal(
    mergeData(current, {
      ...emptyData(),
      entries: [{ ...imported, id: crypto.randomUUID() }],
    }).skipped,
    1,
  );
});
