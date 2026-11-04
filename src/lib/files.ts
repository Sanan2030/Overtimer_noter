import {
  amount,
  AppData,
  durationMinutes,
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
function excelTime(value: unknown): string {
  const raw = cellValue(value);
  if (raw instanceof Date)
    return `${String(raw.getUTCHours()).padStart(2, "0")}:${String(raw.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof raw === "number" && raw >= 0 && raw < 1)
    return formatDuration(Math.round(raw * 1440) % 1440);
  const match = str(raw).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) throw new Error("Saat HH:MM formatında olmalıdır.");
  const result = `${match[1].padStart(2, "0")}:${match[2]}`;
  timeMinutes(result);
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
export async function createWorkbook(
  data: AppData,
  entries: Entry[] = data.entries,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Overtime";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Overtime qeydləri", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(EXCEL_HEADERS);
  for (const entry of [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  )) {
    const [year, month] = entry.date.split("-").map(Number);
    sheet.addRow([
      year,
      MONTHS[month - 1],
      entry.employee,
      entry.manager,
      entry.customer,
      entry.project,
      new Date(`${entry.date}T00:00:00Z`),
      timeMinutes(entry.start) / 1440,
      timeMinutes(entry.end) / 1440,
      entry.dayStatus,
      entry.environment,
      durationMinutes(entry) / 1440,
      entry.subject,
      entry.reason,
      entry.multiplier,
      entryRate(entry, data.months),
      amount(entry, data.months),
    ]);
  }
  const widths = [
    9, 15, 25, 25, 16, 20, 15, 13, 13, 23, 20, 23, 58, 23, 10, 22, 20,
  ];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.getColumn(7).numFmt = "dd.mm.yyyy";
  [8, 9].forEach((c) => {
    sheet.getColumn(c).numFmt = "hh:mm";
  });
  sheet.getColumn(12).numFmt = "[h]:mm";
  [16, 17].forEach((c) => {
    sheet.getColumn(c).numFmt = "0.00";
  });
  sheet.autoFilter = { from: "A1", to: "Q1" };
  sheet.eachRow((row, number) => {
    row.alignment = { vertical: "middle", wrapText: true };
    if (number > 1) {
      row.height = 36;
      if (number % 2 === 0)
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F6F5" },
          };
        });
    }
  });
  styleHeader(sheet.getRow(1));
  const summary = workbook.addWorksheet("Aylıq yekun");
  summary.addRow([
    "Ay",
    "Qeyd sayı",
    "Faktiki müddət",
    "Məbləğ (AZN)",
    "Tarifsiz qeydlər",
  ]);
  const groups = new Map<string, Entry[]>();
  entries.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), entry]);
  });
  for (const [month, rows] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    summary.addRow([
      month,
      rows.length,
      rows.reduce((s, e) => s + durationMinutes(e), 0) / 1440,
      rows.reduce((s, e) => s + (amount(e, data.months) ?? 0), 0),
      rows.filter((e) => amount(e, data.months) === null).length,
    ]);
  }
  summary.columns.forEach((c) => {
    c.width = 23;
  });
  summary.getColumn(3).numFmt = "[h]:mm";
  summary.getColumn(4).numFmt = "0.00";
  styleHeader(summary.getRow(1));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
function styleHeader(row: import("exceljs").Row) {
  row.height = 42;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF133C35" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
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
        if (str(cell.value)) map.set(normalize(cell.value), column);
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
          end = excelTime(get("Bitmə"));
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
        const duration = reported ?? elapsed;
        if (duration <= 0 || duration > elapsed)
          throw new Error("Müddət başlanma–bitmə aralığına uyğun deyil.");
        if (
          rate !== null &&
          total !== null &&
          Math.abs(
            Math.round((duration / 60) * rate * multiplier * 100) / 100 - total,
          ) > 0.011
        )
          throw new Error("Məbləğ, tarif və əmsal bir-birinə uyğun deyil.");
        if (rate === null && total !== null)
          rate = total / ((duration / 60) * multiplier);
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
