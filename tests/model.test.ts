import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amount,
  calculationParts,
  dailyEntries,
  validateEntry,
  durationMinutes,
  emptyData,
  emptyProfile,
  formatDuration,
  hourlyRate,
  isDate,
  mergeData,
  money,
  newEntry,
  overlaps,
  validateData,
} from "../src/lib/model";

const entry = (overrides: Partial<ReturnType<typeof newEntry>> = {}) => ({
  ...newEntry(emptyProfile, "2026-10-02"),
  multiplier: 1 as const,
  nightPercent: 0,
  ...overrides,
});

test("monthly net salary, minutes and each multiplier calculate correctly", () => {
  const months = { "2026-10": { salary: 1320, hours: 160 } };
  for (const multiplier of [1, 2, 3] as const)
    assert.equal(
      amount(entry({ end: "19:30", multiplier }), months),
      11.25 * multiplier,
    );
});
test("legacy overnight breaks are allocated across the actual months", () => {
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
      "2026-10": { salary: 1320, hours: 160 },
      "2026-11": { salary: 2400, hours: 160 },
    }),
    81.51,
  );
  assert.equal(formatDuration(210), "03:30");
});
test("missing rates remain unpriced, zero salary remains a valid rate", () => {
  assert.equal(amount(entry(), {}), null);
  assert.equal(amount(entry(), { "2026-10": { salary: 0, hours: 160 } }), 0);
});
test("monthly salaries use official norms rather than a legacy snapshot rate", () => {
  assert.equal(
    amount(entry({ rate: 10 }), { "2026-10": { salary: 1320, hours: 160 } }),
    15,
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
    months: { "2026-10": { salary: 1320, hours: 160 } },
  };
  const imported = {
    ...emptyData(),
    months: { "2026-10": { salary: 1760, hours: 160 } },
    entries: [entry()],
  };
  const first = mergeData(current, imported);
  assert.equal(first.added, 1);
  assert.equal(first.data.months["2026-10"].salary, 1320);
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
    0.35,
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

const twoMonths = {
  "2026-10": { salary: 1320, hours: 176 },
  "2026-11": { salary: 1320, hours: 152 },
};
test("31 October 19:00–1 November 02:00 uses each month's net tariff without a night premium", () => {
  const row = entry({
    date: "2026-10-31",
    start: "19:00",
    end: "02:00",
    multiplier: 2,
    nightPercent: 20,
  });
  const parts = calculationParts(row, twoMonths);
  assert.deepEqual(
    parts.map((p) => [p.month, p.minutes, p.norm]),
    [
      ["2026-10", 300, 176],
      ["2026-11", 120, 152],
    ],
  );
  assert.equal(parts[0].base, 75);
  assert.equal(parts[0].total, 75);
  assert.equal(parts[1].total, 34.74);
  assert.equal(amount(row, twoMonths), 109.74);
  const ledger = dailyEntries([row], twoMonths);
  assert.equal(ledger[0].sourceId, row.id);
  assert.equal(
    ledger.reduce((sum, p) => sum + durationMinutes(p), 0),
    420,
  );
  assert.ok(
    Math.abs(
      ledger.reduce((sum, p) => sum + amount(p, twoMonths)!, 0) - 109.74,
    ) < 1e-9,
  );
  assert.deepEqual(dailyEntries(ledger, twoMonths), ledger);
});
test("next month cannot inherit the previous month's snapshot rate", () => {
  const row = entry({
    date: "2026-10-31",
    start: "19:00",
    end: "02:00",
    rate: 7.5,
    multiplier: 2,
    nightPercent: 20,
  });
  assert.equal(amount(row, { "2026-10": twoMonths["2026-10"] }), null);
  assert.equal(calculationParts(row, {})[1].rate, null);
  assert.equal(
    amount({ ...row, rates: { "2026-11": 1320 / 152 } }, {}),
    109.74,
  );
  assert.equal(
    amount(row, { ...twoMonths, "2026-11": { salary: 1520, hours: 152 } }),
    115,
  );
});
test("old night percentages do not add a premium to current overtime amounts", () => {
  for (const nightPercent of [0, 20, 40, 100]) {
    assert.equal(
      amount(
        entry({ start: "22:00", end: "23:00", multiplier: 2, nightPercent }),
        twoMonths,
      ),
      15,
    );
    assert.equal(
      amount(
        entry({ start: "22:00", end: "23:00", multiplier: 3, nightPercent }),
        twoMonths,
      ),
      22.5,
    );
  }
});
test("midnight endpoints do not create an empty next-day record", () => {
  const row = entry({ date: "2026-10-31", start: "19:00", end: "00:00" });
  assert.equal(dailyEntries([row]).length, 1);
  assert.equal(durationMinutes(validateEntry({ ...row, end: "24:00" })), 300);
  assert.throws(() => validateEntry({ ...row, start: "24:00" }));
});
test("old JSON keeps salary basis and new entries default to 2x without a night percentage", () => {
  const row = entry();
  const { nightPercent: _night, ...old } = row;
  const restored = validateData({
    ...emptyData(),
    months: twoMonths,
    entries: [old],
  });
  assert.equal(restored.entries[0].nightPercent, undefined);
  assert.equal(restored.months["2026-10"].basis, undefined);
  const fresh = newEntry(emptyProfile, "2026-10-31");
  assert.equal(fresh.multiplier, 2);
  assert.equal(fresh.nightPercent, undefined);
  assert.throws(() => validateEntry({ ...row, nightPercent: -1 }));
});

test("a whole-shift backup fills only the missing side of an imported month report", () => {
  const row = entry({
    date: "2026-10-31",
    start: "19:00",
    end: "02:00",
    multiplier: 2,
    nightPercent: 20,
  });
  const { sourceId: _source, ...october } = dailyEntries([row], twoMonths)[0];
  const current = { ...emptyData(), months: twoMonths, entries: [october] };
  const merged = mergeData(current, {
    ...emptyData(),
    months: twoMonths,
    entries: [row],
  });
  assert.equal(merged.added, 1);
  assert.equal(merged.data.entries.length, 2);
  assert.equal(
    merged.data.entries.reduce((sum, e) => sum + durationMinutes(e), 0),
    420,
  );
  assert.equal(
    mergeData(merged.data, {
      ...emptyData(),
      months: twoMonths,
      entries: [row],
    }).added,
    0,
  );
});

test("gross months cannot supply a net tariff or fall back to old gross snapshots", () => {
  const gross = { salary: 1320, hours: 176, basis: "gross" as const };
  const row = entry({
    date: "2026-10-31",
    start: "19:00",
    end: "02:00",
    multiplier: 2,
    nightPercent: 20,
    rate: 7.5,
    rates: { "2026-11": 7.5 },
  });
  const months = {
    "2026-10": { salary: 880, hours: 176, basis: "net" as const },
    "2026-11": gross,
  };
  assert.equal(hourlyRate(gross, "2026-10"), null);
  assert.equal(amount(row, months), null);
  assert.deepEqual(
    calculationParts(row, months).map((p) => p.total),
    [50, null],
  );
  assert.equal(
    amount(row, {
      ...months,
      "2026-11": { salary: 760, hours: 152, basis: "net" },
    }),
    70,
  );
  assert.equal(
    amount(
      { ...row, date: "2026-10-02", start: "18:00", end: "20:00" },
      { "2026-10": gross },
    ),
    null,
  );
  assert.deepEqual(
    validateData({ ...emptyData(), months: { "2026-10": gross } }).months[
      "2026-10"
    ],
    gross,
  );
});

test("Excel can match work fields while JSON retains entries with distinct multipliers", () => {
  const one = entry({ multiplier: 1 });
  const three = { ...one, id: crypto.randomUUID(), multiplier: 3 as const };
  const imported = { ...emptyData(), entries: [one, three] };
  assert.equal(mergeData(emptyData(), imported).added, 2);
  const current = { ...emptyData(), entries: [three] };
  const excel = mergeData(
    current,
    { ...emptyData(), entries: [one] },
    { matchByWork: true },
  );
  assert.equal(excel.added, 0);
  assert.equal(excel.data.entries[0].multiplier, 3);
});
