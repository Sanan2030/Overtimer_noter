import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import {
  createWorkbook,
  EXCEL_HEADERS,
  jsonBackup,
  parseBackup,
  parseWorkbook,
} from "../src/lib/files";
import {
  amount,
  durationMinutes,
  emptyData,
  emptyProfile,
  mergeData,
  newEntry,
} from "../src/lib/model";

async function source(
  rows: unknown[][],
  date1904 = false,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.properties.date1904 = date1904;
  const sheet = workbook.addWorksheet("Qeydlər");
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Uint8Array.from(buffer as unknown as Uint8Array).buffer;
}
test("JSON round trip preserves all data, including monthly salary and profile", () => {
  const data = {
    ...emptyData(),
    months: { "2026-10": { salary: 1320, hours: 176 } },
    entries: [newEntry(emptyProfile, "2026-10-02")],
  };
  assert.deepEqual(parseBackup(jsonBackup(data)), data);
  assert.throws(() => parseBackup("{broken"), /JSON/);
  assert.throws(() => parseBackup('{"version":2}'));
});
test("imports the original 14-column company format without a rate", async () => {
  const buffer = await source([
    EXCEL_HEADERS.slice(0, 14),
    [
      2026,
      "Oktyabr",
      "İnci Məmmədzadə",
      "Emin Əsgərsoy",
      "ƏN",
      "AzDoc 3.0",
      "02.10.2026",
      "18:00",
      "21:00",
      "qeyri-iş saatı",
      "ofis şəraiti",
      "03:00",
      "NMR AzDoc — PROD üçün test",
      "Test",
    ],
  ]);
  const result = await parseWorkbook(buffer);
  const row = result.entries[0];
  assert.equal(row.date, "2026-10-02");
  assert.equal(row.employee, "İnci Məmmədzadə");
  assert.equal(durationMinutes(row), 180);
  assert.equal(row.multiplier, 1);
  assert.equal(amount(row, {}), null);
  assert.equal(amount(row, { "2026-10": { salary: 1320, hours: 176 } }), 22.5);
});
test("XLSX exports the chosen green company table and preserves work fields on reimport", async () => {
  const row = {
    ...newEntry(
      { ...emptyProfile, employee: "İnci", project: "AzDoc" },
      "2026-10-02",
    ),
    start: "22:00",
    end: "02:00",
    breakMinutes: 30,
    nightPercent: 0,
    multiplier: 3 as const,
    subject: '=HYPERLINK("https://example.org")',
  };
  const data = {
    ...emptyData(),
    months: { "2026-10": { salary: 1320, hours: 176 } },
    entries: [row],
  };
  const buffer = await createWorkbook(data);
  const imported = await parseWorkbook(Uint8Array.from(buffer).buffer);
  assert.equal(imported.entries.length, 2);
  assert.equal(
    imported.entries.reduce((sum, row) => sum + durationMinutes(row), 0),
    210,
  );
  assert.equal(
    imported.entries.reduce((sum, row) => sum + row.breakMinutes, 0),
    30,
  );
  assert.equal(imported.entries[0].subject, row.subject);
  assert.ok(
    imported.entries.every((row) => row.rate === null && row.multiplier === 1),
  );
  const merged = mergeData(data, imported, { matchByWork: true });
  assert.equal(merged.added, 0);
  assert.equal(merged.data.entries[0].multiplier, 3);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
  assert.equal(workbook.worksheets.length, 1);
  const sheet = workbook.getWorksheet("Overtime")!;
  assert.equal(sheet.rowCount, 3);
  assert.equal(sheet.columnCount, 14);
  assert.deepEqual((sheet.getRow(1).values as string[]).slice(1), [
    "İl",
    "Ay",
    "Əməkdaş",
    "Şöbə müdiri",
    "Müştəri",
    "Layihə",
    "Tarix",
    "Başlanma",
    "Bitmə",
    "İcra günü statusu",
    "İş mühiti",
    "Müddət\u00a0\n(saat: dəqiqə)",
    "Mövzu",
    "Səbəb",
  ]);
  assert.equal(sheet.getCell("M2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("M2").value, row.subject);
  assert.deepEqual(sheet.getCell("A1").fill, {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE6F1E8" },
  });
  assert.equal(sheet.getColumn(7).numFmt, "dd.mm.yyyy");
  assert.equal(sheet.getColumn(8).numFmt, "hh:mm");
  assert.equal(sheet.getColumn(12).numFmt, "[hh]:mm");
});
test("invalid Excel rows reject the whole file with row diagnostics", async () => {
  const buffer = await source([
    ["Tarix", "Başlanma", "Bitmə"],
    ["02.10.2026", "18:00", "20:00"],
    ["31.02.2026", "18:00", "20:00"],
  ]);
  await assert.rejects(parseWorkbook(buffer), /sətir 3/);
});
test("original Excel duration infers an unpaid break", async () => {
  const buffer = await source([
    ["Tarix", "Başlanma", "Bitmə", "Müddət\u00a0\n(saat: dəqiqə)"],
    ["02.10.2026", 18 / 24, 21 / 24, 2.5 / 24],
  ]);
  const result = await parseWorkbook(buffer);
  assert.equal(result.entries[0].breakMinutes, 30);
});
test("Excel with amount but no rate reconstructs its tariff", async () => {
  const buffer = await source([
    ["Tarix", "Başlanma", "Bitmə", "Məbləğ", "Əmsal"],
    ["02.10.2026", "18:00", "20:00", "30,00", "2x"],
  ]);
  const result = await parseWorkbook(buffer);
  assert.equal(result.entries[0].rate, 7.5);
  assert.equal(amount(result.entries[0], {}), 30);
});
test("Excel date serial respects the workbook's 1904 calendar", async () => {
  const buffer = await source(
    [
      ["Tarix", "Başlanma", "Bitmə"],
      [1, "18:00", "20:00"],
    ],
    true,
  );
  const result = await parseWorkbook(buffer);
  assert.equal(result.entries[0].date, "1904-01-02");
});
test("unrelated sheets and empty workbooks are rejected", async () => {
  await assert.rejects(
    parseWorkbook(
      await source([
        ["Name", "Amount"],
        ["Example", 100],
      ]),
    ),
    /Qeyd tapılmadı/,
  );
});
test("negative or inconsistent money columns are not silently changed", async () => {
  const headers = ["Tarix", "Başlanma", "Bitmə", "Saatlıq tarif", "Məbləğ"];
  await assert.rejects(
    parseWorkbook(
      await source([headers, ["02.10.2026", "18:00", "20:00", 7.5, -15]]),
    ),
    /mənfi/,
  );
  await assert.rejects(
    parseWorkbook(
      await source([headers, ["02.10.2026", "18:00", "20:00", 7.5, 100]]),
    ),
    /uyğun deyil/,
  );
});

test("month-boundary Excel contains only the two dated work parts and reimports without duplicates", async () => {
  const row = {
    ...newEntry(emptyProfile, "2026-10-31"),
    start: "19:00",
    end: "02:00",
  };
  const data = {
    ...emptyData(),
    months: {
      "2026-10": { salary: 1320, hours: 176, basis: "net" as const },
      "2026-11": { salary: 1320, hours: 152, basis: "net" as const },
    },
    entries: [row],
  };
  const bytes = await createWorkbook(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  assert.equal(workbook.worksheets.length, 1);
  const details = workbook.getWorksheet("Overtime")!;
  assert.equal(details.columnCount, 14);
  assert.equal(details.rowCount, 3);
  assert.equal(
    (details.getCell("G2").value as Date).toISOString().slice(0, 10),
    "2026-10-31",
  );
  assert.equal(
    (details.getCell("G3").value as Date).toISOString().slice(0, 10),
    "2026-11-01",
  );
  assert.equal(details.getCell("I2").value, "24:00");
  const imported = await parseWorkbook(Uint8Array.from(bytes).buffer);
  assert.deepEqual(
    imported.entries.map((e) => durationMinutes(e)),
    [300, 120],
  );
  assert.equal(mergeData(data, imported, { matchByWork: true }).added, 0);
  const first = mergeData(emptyData(), imported, { matchByWork: true });
  assert.equal(first.added, 2);
  assert.equal(mergeData(first.data, imported, { matchByWork: true }).added, 0);
});

test("an empty export contains just the company column headers", async () => {
  const bytes = await createWorkbook(emptyData());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(workbook.worksheets[0].rowCount, 1);
  assert.equal(workbook.worksheets[0].columnCount, 14);
});

test("old Excel night premiums are stripped while preserving the original hourly tariff", async () => {
  const bytes = await source([
    ["Tarix", "Başlanma", "Bitmə", "Məbləğ", "Əmsal", "Gecə əlavəsi (%)"],
    ["02.10.2026", "22:00", "23:00", 16.5, 2, 20],
  ]);
  const imported = await parseWorkbook(bytes);
  assert.ok(Math.abs(imported.entries[0].rate! - 7.5) < 1e-9);
  assert.equal(imported.entries[0].nightPercent, undefined);
  assert.equal(amount(imported.entries[0], {}), 15);
});
