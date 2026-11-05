import type { Worksheet, Row } from "exceljs";
import { getWorkNorm, WORK_SCHEDULE } from "./work-calendar";
import {
  amount,
  dailyEntries,
  nightMinutes,
  calculationParts,
  roundMoney,
  AppData,
  durationMinutes,
  displayDate,
  hourlyRate,
  localDate,
  monthLabel,
  emptyData,
  Entry,
  entryRate,
  formatDuration,
  isDate,
  MONTHS,
  timeMinutes,
  validateData,
} from "./model";

export const EXCEL_HEADERS = [
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
  "Müddət (saat: dəqiqə)",
  "Mövzu",
  "Səbəb",
  "Əmsal",
  "Saatlıq tarif (AZN)",
  "Məbləğ (AZN)",
  "Gecə müddəti (saat:dəqiqə)",
  "Gecə əlavəsi (%)",
  "Gecə əlavəsi (AZN)",
  "Əsas məbləğ (AZN)",
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
type Cell = unknown;
function cellValue(cell: Cell): unknown {
  if (cell && typeof cell === "object" && !(cell instanceof Date)) {
    const value = cell as Record<string, unknown>;
    if ("result" in value) return cellValue(value.result);
    if (Array.isArray(value.richText))
      return value.richText
        .map((part: { text?: string }) => part.text ?? "")
        .join("");
    if ("text" in value) return value.text;
    throw new Error(
      "Dəstəklənməyən Excel hüceyrəsi var. Formulları dəyər kimi saxlayıb yenidən yoxlayın.",
    );
  }
  return cell;
}
function str(value: unknown): string {
  return String(cellValue(value) ?? "").trim();
}
function normalize(value: unknown): string {
  return str(value)
    .toLocaleLowerCase("az")
    .replace(/[\s\u00a0:()_.\-]+/g, "");
}
function numeric(value: unknown, label: string): number | null {
  const raw = cellValue(value);
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const number = Number(
    str(raw).replace(/\s/g, "").replace(/AZN|₼/gi, "").replace(",", "."),
  );
  if (!Number.isFinite(number)) throw new Error(`${label} rəqəm olmalıdır.`);
  return number;
}
function excelDate(value: unknown, date1904: boolean): string {
  const raw = cellValue(value);
  let date: string;
  if (raw instanceof Date) date = raw.toISOString().slice(0, 10);
  else if (typeof raw === "number")
    date = new Date(
      Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) +
        Math.floor(raw) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  else {
    const input = str(raw);
    const match = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    date = match
      ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
      : input;
  }
  if (!isDate(date))
    throw new Error("Tarix GG.AA.İİİİ və ya İİİİ-AA-GG formatında olmalıdır.");
  return date;
}
function excelTime(value: unknown, allowMidnight = false): string {
  const raw = cellValue(value);
  if (raw instanceof Date)
    return `${String(raw.getUTCHours()).padStart(2, "0")}:${String(raw.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof raw === "number" && raw >= 0 && raw < 1)
    return formatDuration(Math.round(raw * 1440) % 1440);
  const match = str(raw).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) throw new Error("Saat HH:MM formatında olmalıdır.");
  const result = `${match[1].padStart(2, "0")}:${match[2]}`;
  timeMinutes(result, allowMidnight);
  return result;
}
function excelDuration(value: unknown): number | null {
  const raw = cellValue(value);
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && raw >= 0 && raw < 1)
    return Math.round(raw * 1440);
  if (raw instanceof Date) return raw.getUTCHours() * 60 + raw.getUTCMinutes();
  const match = str(raw).match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
  if (!match || Number(match[2]) > 59)
    throw new Error("Müddət saat:dəqiqə formatında olmalıdır.");
  return Number(match[1]) * 60 + Number(match[2]);
}
export const REPORT_HEADER_ROW = 6;
const REPORT_COLORS = {
  green: "FF14523E",
  pale: "FFE9F3EE",
  stripe: "FFF6F9F7",
  text: "FF243D31",
  border: "FFDFE8E2",
};

export async function createWorkbook(
  data: AppData,
  entries: Entry[] = data.entries,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ArtıSaat";
  workbook.subject = "Əlavə iş saatları və məbləğlər";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  entries = dailyEntries(entries, data.months);
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  );
  const dates = sorted.map((entry) => entry.date);
  const period = dates.length
    ? `${displayDate(dates[0])} — ${displayDate(dates[dates.length - 1])}`
    : "Qeyd yoxdur";
  const employees = [
    ...new Set(entries.map((entry) => entry.employee).filter(Boolean)),
  ];
  const owner = employees.length
    ? `Əməkdaş: ${employees.join(", ")}`
    : "Şəxsi əlavə iş hesabatı";
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + durationMinutes(entry),
    0,
  );
  const totalMoney = roundMoney(
    entries.reduce((sum, entry) => sum + (amount(entry, data.months) ?? 0), 0),
  );

  // The first sheet is a compact report. The second retains all 17 original columns.
  const summary = workbook.addWorksheet("Aylıq yekun", {
    views: [
      { state: "frozen", ySplit: 6, showGridLines: false, zoomScale: 95 },
    ],
  });
  const widths = [23, 20, 16, 22, 23, 13, 22, 18];
  widths.forEach((width, index) => {
    summary.getColumn(index + 1).width = width;
  });
  reportTitle(summary, 8, "ARTISAAT · AYLIQ HESABAT", period, owner);
  summary.mergeCells("A5:H5");
  summary.getCell("A5").value =
    "Tarif = ayın maaşı ÷ rəsmi norma · məbləğə ayrıca gecə əlavəsi daxildir · " +
    WORK_SCHEDULE;
  summary.getCell("A5").font = {
    name: "Calibri",
    size: 10,
    color: { argb: "FF6B7D72" },
  };
  summary.getRow(5).height = 25;
  summary.getRow(6).values = [
    "Ay",
    "Aylıq maaş (AZN)",
    "Norma (saat)",
    "Saatlıq tarif (AZN)",
    "Overtime (saat:dəqiqə)",
    "Qeyd sayı",
    "Məbləğ (AZN)",
    "Tarifsiz qeydlər",
  ];
  styleHeader(summary.getRow(6));
  const groups = new Map<string, Entry[]>();
  sorted.forEach((entry) => {
    const key = entry.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  for (const [month, rows] of groups) {
    const norm = getWorkNorm(month);
    const row = summary.addRow([
      `${monthLabel(month)}\n${data.months[month]?.basis === "gross" ? "Brutto tarif" : "Əvvəlki net / idxal"}`,
      data.months[month]?.salary ?? null,
      norm?.hours ?? null,
      hourlyRate(data.months[month], month),
      rows.reduce((sum, e) => sum + durationMinutes(e), 0) / 1440,
      rows.length,
      rows.reduce((sum, e) => sum + (amount(e, data.months) ?? 0), 0),
      rows.filter((e) => amount(e, data.months) === null).length,
    ]);
    styleDataRow(row, groups.size > 0 && row.number % 2 === 1);
    row.height = 34;
  }
  [2, 4, 7].forEach((index) => {
    summary.getColumn(index).numFmt = "#,##0.00";
  });
  summary.getColumn(5).numFmt = "[h]:mm";
  const summaryEnd = summary.rowCount;
  summary.autoFilter = `A6:H${summaryEnd}`;
  const summaryTotal = summary.getRow(summaryEnd + 1);
  summary.mergeCells(summaryTotal.number, 1, summaryTotal.number, 4);
  summaryTotal.getCell(1).value = "YEKUN";
  setSum(summaryTotal.getCell(5), "E", summaryEnd, totalMinutes / 1440);
  setSum(summaryTotal.getCell(6), "F", summaryEnd, entries.length);
  setSum(summaryTotal.getCell(7), "G", summaryEnd, totalMoney);
  setSum(
    summaryTotal.getCell(8),
    "H",
    summaryEnd,
    entries.filter((e) => amount(e, data.months) === null).length,
  );
  styleTotal(summaryTotal);
  let noteRow = summaryTotal.number + 2;
  summary.mergeCells(noteRow, 1, noteRow, 8);
  summary.getCell(noteRow, 1).value =
    "Tarifsiz hissələr məbləğə daxil deyil. Hər gün öz ayının tarifi ilə hesablanır. Gecə əlavəsi = gecə saatı × tarif × faiz. Əvvəlki net maaşı brutto tariflə yenilə.";
  summary.getCell(noteRow, 1).font = {
    name: "Calibri",
    size: 10,
    color: { argb: "FF6B7D72" },
  };
  summary.getCell(noteRow, 1).alignment = {
    wrapText: true,
    vertical: "middle",
  };
  summary.getRow(noteRow).height = 30;
  for (const year of [
    ...new Set(sorted.map((entry) => entry.date.slice(0, 4))),
  ]) {
    const norm = getWorkNorm(`${year}-01`);
    if (!norm) continue;
    noteRow++;
    summary.mergeCells(noteRow, 1, noteRow, 8);
    summary.getCell(noteRow, 1).value = {
      text: `Norma mənbəyi: ƏƏSMN — ${year} istehsalat təqvimi`,
      hyperlink: norm.sourceUrl,
    };
    summary.getCell(noteRow, 1).font = {
      name: "Calibri",
      size: 10,
      underline: true,
      color: { argb: REPORT_COLORS.green },
    };
    summary.getRow(noteRow).height = 23;
  }
  configurePrint(summary, 8, noteRow, false);

  const sheet = workbook.addWorksheet("Overtime qeydləri", {
    views: [
      {
        state: "frozen",
        xSplit: 3,
        ySplit: 6,
        showGridLines: false,
        zoomScale: 85,
      },
    ],
  });
  [
    7, 12, 24, 24, 13, 20, 14, 11, 11, 23, 20, 20, 45, 23, 10, 20, 21, 17, 14,
    18, 18,
  ].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  reportTitle(sheet, 21, "ARTISAAT · ƏLAVƏ İŞ QEYDLƏRİ", period, owner);
  for (const [from, to, label] of [
    [1, 2, "DÖVR"],
    [3, 4, "ƏMƏKDAŞ"],
    [5, 6, "MÜŞTƏRİ VƏ LAYİHƏ"],
    [7, 12, "İŞ VAXTI"],
    [13, 14, "TAPŞIRIQ"],
    [15, 17, "HESABLAMA"],
    [18, 21, "GECƏ ƏLAVƏSİ"],
  ] as const) {
    sheet.mergeCells(5, from, 5, to);
    const cell = sheet.getCell(5, from);
    cell.value = label;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: REPORT_COLORS.pale },
    };
    cell.font = {
      name: "Calibri",
      bold: true,
      size: 10,
      color: { argb: REPORT_COLORS.green },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  sheet.getRow(5).height = 26;
  sheet.getRow(6).values = EXCEL_HEADERS;
  styleHeader(sheet.getRow(6));
  for (const entry of sorted) {
    const [year, month] = entry.date.split("-").map(Number);
    const row = sheet.addRow([
      year,
      MONTHS[month - 1],
      entry.employee,
      entry.manager,
      entry.customer,
      entry.project,
      new Date(`${entry.date}T00:00:00Z`),
      timeMinutes(entry.start) / 1440,
      entry.end === "24:00" ? "24:00" : timeMinutes(entry.end) / 1440,
      entry.dayStatus,
      entry.environment,
      durationMinutes(entry) / 1440,
      entry.subject,
      entry.reason,
      entry.multiplier,
      entryRate(entry, data.months),
      amount(entry, data.months),
      nightMinutes(entry) / 1440,
      entry.nightPercent ?? 0,
      calculationParts(entry, data.months)[0]?.supplement === null
        ? null
        : roundMoney(calculationParts(entry, data.months)[0]?.supplement ?? 0),
      calculationParts(entry, data.months)[0]?.base === null
        ? null
        : roundMoney(calculationParts(entry, data.months)[0]?.base ?? 0),
    ]);
    styleDataRow(row, row.number % 2 === 1);
    const lines = Math.max(
      ...[entry.subject, entry.reason, entry.employee, entry.manager].map(
        (text) =>
          text
            .split("\n")
            .reduce(
              (sum, line) => sum + Math.max(1, Math.ceil(line.length / 42)),
              0,
            ),
      ),
    );
    row.height = Math.min(200, Math.max(34, lines * 15 + 12));
    [1, 2, 7, 8, 9, 12, 15].forEach((index) => {
      row.getCell(index).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });
    [16, 17, 20, 21].forEach((index) => {
      row.getCell(index).alignment = {
        horizontal: "right",
        vertical: "middle",
      };
    });
  }
  sheet.getColumn(7).numFmt = "dd.mm.yyyy";
  [8, 9].forEach((index) => {
    sheet.getColumn(index).numFmt = "hh:mm";
  });
  sheet.getColumn(12).numFmt = "[h]:mm";
  sheet.getColumn(18).numFmt = "[h]:mm";
  sheet.getColumn(19).numFmt = '0.##"%"';
  sheet.getColumn(15).numFmt = '0"x"';
  [16, 17, 20, 21].forEach((index) => {
    sheet.getColumn(index).numFmt = "#,##0.00";
  });
  const end = sheet.rowCount;
  sheet.autoFilter = `A6:U${end}`;
  const total = sheet.getRow(end + 1);
  // Leave G:I empty so the total cannot be mistaken for an imported work record.
  sheet.mergeCells(total.number, 1, total.number, 6);
  total.getCell(1).value = "CƏMİ";
  sheet.mergeCells(total.number, 10, total.number, 11);
  total.getCell(10).value = "Müddət";
  setSum(total.getCell(12), "L", end, totalMinutes / 1440);
  sheet.mergeCells(total.number, 13, total.number, 16);
  total.getCell(13).value = "Ümumi məbləğ (AZN)";
  setSum(total.getCell(17), "Q", end, totalMoney);
  setSum(
    total.getCell(18),
    "R",
    end,
    entries.reduce((sum, entry) => sum + nightMinutes(entry), 0) / 1440,
  );
  setSum(
    total.getCell(20),
    "T",
    end,
    entries.reduce(
      (sum, entry) =>
        sum +
        roundMoney(calculationParts(entry, data.months)[0]?.supplement ?? 0),
      0,
    ),
  );
  setSum(
    total.getCell(21),
    "U",
    end,
    entries.reduce(
      (sum, entry) =>
        sum + roundMoney(calculationParts(entry, data.months)[0]?.base ?? 0),
      0,
    ),
  );
  styleTotal(total);
  configurePrint(sheet, 21, total.number, true);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
function reportTitle(
  sheet: Worksheet,
  columns: number,
  title: string,
  period: string,
  owner: string,
) {
  sheet.mergeCells(1, 1, 1, columns);
  const cell = sheet.getCell(1, 1);
  cell.value = title;
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: REPORT_COLORS.green },
  };
  cell.font = {
    name: "Calibri",
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  cell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 41;
  for (const [row, value] of [
    [2, `Hesabat dövrü: ${period}`],
    [3, `${owner} · Hazırlanma: ${displayDate(localDate())}`],
  ] as const) {
    sheet.mergeCells(row, 1, row, columns);
    const meta = sheet.getCell(row, 1);
    meta.value = value;
    meta.font = { name: "Calibri", size: 11, color: { argb: "FF607468" } };
    meta.alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(row).height = 25;
  }
  sheet.getRow(4).height = 12;
}
function styleHeader(row: Row) {
  row.height = 43;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: REPORT_COLORS.green },
    };
    cell.font = {
      name: "Calibri",
      bold: true,
      size: 10,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: REPORT_COLORS.border } },
    };
  });
}
function styleDataRow(row: Row, stripe: boolean) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      color: { argb: REPORT_COLORS.text },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: stripe ? REPORT_COLORS.stripe : "FFFFFFFF" },
    };
    cell.border = {
      bottom: { style: "hair", color: { argb: REPORT_COLORS.border } },
    };
  });
}
function styleTotal(row: Row) {
  row.height = 34;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: REPORT_COLORS.pale },
    };
    cell.font = {
      name: "Calibri",
      bold: true,
      size: 11,
      color: { argb: REPORT_COLORS.green },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: typeof cell.value === "string" ? "left" : "right",
      wrapText: true,
    };
    cell.border = { top: { style: "thin", color: { argb: "FFB7D1C2" } } };
  });
}
function setSum(
  cell: import("exceljs").Cell,
  column: string,
  end: number,
  result: number,
) {
  cell.value =
    end >= 7 ? { formula: `SUM(${column}7:${column}${end})`, result } : 0;
}
function configurePrint(
  sheet: Worksheet,
  columns: number,
  end: number,
  wide: boolean,
) {
  // A3 is ECMA-376 paper size 8; ExcelJS's numeric enum omits this supported value.
  sheet.pageSetup = {
    paperSize: (wide ? 8 : 9) as import("exceljs").PaperSize,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:6",
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.15,
      footer: 0.15,
    },
    printArea: `A1:${String.fromCharCode(64 + columns)}${end}`,
  };
  sheet.headerFooter = { oddFooter: "&LArtıSaat&CƏlavə iş hesabatı&R&P / &N" };
}
export async function parseWorkbook(buffer: ArrayBuffer): Promise<AppData> {
  if (buffer.byteLength > MAX_FILE_SIZE)
    throw new Error("Fayl ən çox 10 MB ola bilər.");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const result = emptyData();
  const errors: string[] = [];
  for (const sheet of workbook.worksheets) {
    let headerRow = 0;
    let columns = new Map<string, number>();
    for (let i = 1; i <= Math.min(sheet.rowCount, 30); i++) {
      const map = new Map<string, number>();
      sheet.getRow(i).eachCell((cell, column) => {
        // Summary/total formulas are not header labels and may lack cached results.
        try {
          if (str(cell.value)) map.set(normalize(cell.value), column);
        } catch {
          /* Continue looking for the actual column headers. */
        }
      });
      if (["tarix", "başlanma", "bitmə"].every((key) => map.has(key))) {
        columns = map;
        headerRow = i;
        break;
      }
    }
    if (!headerRow) continue;
    for (let i = headerRow + 1; i <= sheet.rowCount; i++) {
      if (result.entries.length >= 50000)
        throw new Error("Ən çox 50 000 qeyd idxal etmək olar.");
      const row = sheet.getRow(i);
      const get = (name: string): unknown => {
        const col = columns.get(normalize(name));
        return col ? row.getCell(col).value : null;
      };
      if (!["Tarix", "Başlanma", "Bitmə"].some((key) => str(get(key))))
        continue;
      try {
        const date = excelDate(
          get("Tarix"),
          Boolean(workbook.properties.date1904),
        );
        const start = excelTime(get("Başlanma")),
          end = excelTime(get("Bitmə"), true);
        const elapsed = durationMinutes({ start, end, breakMinutes: 0 });
        const reported = excelDuration(
          get("Müddət (saat: dəqiqə)") ?? get("Müddət"),
        );
        const rawMultiplier = str(get("Əmsal")).replace(/[x×]/g, "");
        const multiplier = rawMultiplier ? Number(rawMultiplier) : 1;
        if (![1, 2, 3].includes(multiplier))
          throw new Error("Əmsal 1, 2 və ya 3 olmalıdır.");
        let rate = numeric(
          get("Saatlıq tarif (AZN)") ?? get("Saatlıq tarif"),
          "Saatlıq tarif",
        );
        const total = numeric(get("Məbləğ (AZN)") ?? get("Məbləğ"), "Məbləğ");
        if ((rate !== null && rate < 0) || (total !== null && total < 0))
          throw new Error("Tarif və məbləğ mənfi ola bilməz.");
        const nightPercent =
          numeric(get("Gecə əlavəsi (%)"), "Gecə faizi") ?? 0;
        if (nightPercent < 0 || nightPercent > 1000)
          throw new Error("Gecə əlavəsi 0–1000% aralığında olmalıdır.");
        const night = nightMinutes({
          date,
          start,
          end,
          breakMinutes: 0,
        } as Entry);
        const duration = reported ?? elapsed;
        if (duration <= 0 || duration > elapsed)
          throw new Error("Müddət başlanma–bitmə aralığına uyğun deyil.");
        if (
          rate !== null &&
          total !== null &&
          Math.abs(
            roundMoney(
              rate *
                ((duration / 60) * multiplier +
                  ((night / 60) * nightPercent) / 100),
            ) - total,
          ) > 0.011
        )
          throw new Error("Məbləğ, tarif və əmsal bir-birinə uyğun deyil.");
        if (rate === null && total !== null)
          rate =
            total /
            ((duration / 60) * multiplier +
              ((night / 60) * nightPercent) / 100);
        const entry: Entry = {
          id: crypto.randomUUID(),
          date,
          start,
          end,
          breakMinutes: elapsed - duration,
          multiplier: multiplier as Entry["multiplier"],
          employee: str(get("Əməkdaş")),
          manager: str(get("Şöbə müdiri")),
          customer: str(get("Müştəri")),
          project: str(get("Layihə")),
          dayStatus: str(get("İcra günü statusu")) || "qeyri-iş saatı",
          environment: str(get("İş mühiti")),
          subject: str(get("Mövzu")),
          reason: str(get("Səbəb")),
          rate,
          ...(nightPercent ? { nightPercent } : {}),
        };
        result.entries.push(entry);
      } catch (error) {
        errors.push(
          `${sheet.name}, sətir ${i}: ${error instanceof Error ? error.message : "Oxunma xətası"}`,
        );
        if (errors.length >= 5) break;
      }
    }
    if (errors.length >= 5) break;
  }
  if (errors.length)
    throw new Error(`Fayl idxal edilmədi. ${errors.join(" ")}`);
  if (!result.entries.length)
    throw new Error(
      "Qeyd tapılmadı. Excel faylında Tarix, Başlanma və Bitmə sütunları olmalıdır.",
    );
  return validateData(result);
}
export function jsonBackup(data: AppData): string {
  return JSON.stringify(
    { ...data, exportedAt: new Date().toISOString(), application: "Overtime" },
    null,
    2,
  );
}
export function parseBackup(value: string): AppData {
  try {
    return validateData(JSON.parse(value));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("JSON faylı oxunmur. Düzgün ehtiyat nüsxəsi seçin.");
    throw error;
  }
}
export function downloadFile(
  content: BlobPart,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
