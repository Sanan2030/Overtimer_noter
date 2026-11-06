import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnalytics, percentageChange } from "../src/lib/analytics";
import { emptyData, emptyProfile, newEntry } from "../src/lib/model";
import { analyticsFixture } from "./fixtures/analytics";

test("analytics uses real minutes, net pay, days and averages for the selected and previous month", () => {
  const report = buildAnalytics(analyticsFixture(), "2026-10");
  assert.deepEqual(report.summary, {
    minutes: 1440,
    days: 5,
    average: 288,
    knownAmount: 360,
    unpriced: 0,
    count: 5,
  });
  assert.equal(report.previous.minutes, 1080);
  assert.equal(report.previous.knownAmount, 270);
  assert.equal(report.previous.days, 4);
  assert.equal(report.previous.average, 270);
  assert.deepEqual(
    report.projects.map((p) => [p.label, p.minutes, p.knownAmount]),
    [
      ["AzDoc 3.0", 840, 210],
      ["Daxili işlər", 360, 60],
      ["Digər", 240, 90],
    ],
  );
  assert.deepEqual(
    report.multipliers.map((p) => [p.multiplier, p.minutes, p.knownAmount]),
    [
      [1, 240, 30],
      [2, 960, 240],
      [3, 240, 90],
    ],
  );
  assert.equal(report.dominant.multiplier, 2);
  assert.deepEqual(
    report.trend.map((p) => p.minutes / 60),
    [12, 16, 10, 22, 18, 24],
  );
});
test("calendar weeks include month boundaries and classify only the recorded day status", () => {
  const report = buildAnalytics(analyticsFixture(), "2026-10");
  assert.deepEqual(
    report.weeks.map((w) => [w.start, w.end, w.minutes]),
    [
      [1, 4, 240],
      [5, 11, 720],
      [12, 18, 360],
      [19, 25, 0],
      [26, 31, 120],
    ],
  );
  assert.equal(report.weeks[1].special, 240);
  assert.equal(
    report.weeks.reduce((sum, week) => sum + week.minutes, 0),
    report.summary.minutes,
  );
  const data = analyticsFixture();
  data.entries.push({
    ...newEntry(emptyProfile, "2026-11-30"),
    start: "18:00",
    end: "19:00",
  });
  const november = buildAnalytics(data, "2026-11");
  assert.equal(november.weeks.length, 6);
  assert.equal(november.weeks[5].minutes, 60);
});
test("unpriced entries keep their hours and are excluded from known monetary totals", () => {
  const data = analyticsFixture();
  delete data.months["2026-10"];
  const missing = buildAnalytics(data, "2026-10");
  assert.equal(missing.summary.minutes, 1440);
  assert.equal(missing.summary.unpriced, 5);
  assert.equal(missing.summary.knownAmount, 0);
  assert.deepEqual(missing.missingMonths, ["2026-10"]);
  const october = data.entries.find((e) => e.date === "2026-10-01")!;
  october.rate = 7.5;
  const partial = buildAnalytics(data, "2026-10");
  assert.equal(partial.summary.unpriced, 4);
  assert.equal(partial.summary.knownAmount, 30);
});
test("analytics splits month-end work before aggregating each month and tariff", () => {
  const data = {
    ...emptyData(),
    months: {
      "2026-10": { salary: 1320, hours: 176 },
      "2026-11": { salary: 1320, hours: 152 },
    },
    entries: [
      { ...newEntry(emptyProfile, "2026-10-31"), start: "19:00", end: "02:00" },
    ],
  };
  const october = buildAnalytics(data, "2026-10"),
    november = buildAnalytics(data, "2026-11");
  assert.equal(october.summary.minutes, 300);
  assert.equal(october.summary.knownAmount, 75);
  assert.equal(november.summary.minutes, 120);
  assert.equal(november.summary.knownAmount, 34.74);
  assert.equal(november.previous.knownAmount, 75);
});
test("all-time and empty reports avoid artificial comparisons and zero-baseline percentages", () => {
  const report = buildAnalytics(analyticsFixture(), "all");
  assert.equal(report.summary.minutes, 102 * 60);
  assert.equal(report.anchor, "2026-10");
  assert.equal(report.previousMonth, null);
  assert.deepEqual(report.weeks, []);
  const empty = buildAnalytics(emptyData(), "2026-01");
  assert.equal(empty.summary.average, 0);
  assert.equal(empty.summary.knownAmount, 0);
  assert.equal(empty.previousMonth, "2025-12");
  assert.equal(percentageChange(10, 0), null);
  assert.equal(percentageChange(0, 10), -100);
});
