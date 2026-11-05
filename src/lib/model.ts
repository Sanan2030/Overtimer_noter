import { getWorkNorm } from "./work-calendar";

export const MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "İyun",
  "İyul",
  "Avqust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];
export const STORAGE_KEY = "overtime-noter:v1";
export type Multiplier = 1 | 2 | 3;
export type Profile = {
  employee: string;
  manager: string;
  customer: string;
  project: string;
  environment: string;
};
export type MonthConfig = {
  salary: number;
  hours: number;
  basis?: "net" | "gross";
};
export type Entry = {
  id: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  multiplier: Multiplier;
  employee: string;
  manager: string;
  customer: string;
  project: string;
  dayStatus: string;
  environment: string;
  subject: string;
  reason: string;
  rate: number | null;
  // Historical backup metadata only; never included in current calculations.
  nightPercent?: number;
  rates?: Record<string, number>;
  // A derived daily row; never written into the JSON source records.
  sourceId?: string;
};
export type AppData = {
  version: 1;
  profile: Profile;
  months: Record<string, MonthConfig>;
  entries: Entry[];
};
export const emptyProfile: Profile = {
  employee: "",
  manager: "",
  customer: "",
  project: "",
  environment: "ofis şəraiti",
};
export const emptyData = (): AppData => ({
  version: 1,
  profile: { ...emptyProfile },
  months: {},
  entries: [],
});

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 2200) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
export function isMonth(value: string): boolean {
  return isDate(`${value}-01`);
}
export function timeMinutes(time: string, allowMidnight = false): number {
  if (allowMidnight && time === "24:00") return 1440;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Saat HH:MM formatında olmalıdır.");
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function durationMinutes(
  entry: Pick<Entry, "start" | "end" | "breakMinutes">,
): number {
  const start = timeMinutes(entry.start),
    end = timeMinutes(entry.end, true);
  if (start === end)
    throw new Error("Başlanma və bitmə saatı eyni ola bilməz.");
  const elapsed = (end - start + 1440) % 1440;
  if (
    !Number.isInteger(entry.breakMinutes) ||
    entry.breakMinutes < 0 ||
    entry.breakMinutes >= elapsed
  ) {
    throw new Error(
      "Fasilə iş müddətindən az və mənfi olmayan tam dəqiqə olmalıdır.",
    );
  }
  return elapsed - entry.breakMinutes;
}
export function hourlyRate(
  config?: MonthConfig,
  month?: string,
): number | null {
  if (config?.basis === "gross") return null;
  const hours = month ? getWorkNorm(month)?.hours : config?.hours;
  return config && hours && hours > 0 ? config.salary / hours : null;
}
export function entryRate(
  entry: Entry,
  months: AppData["months"],
): number | null {
  const month = entry.date.slice(0, 7);
  // A previously saved gross salary must be replaced with a net salary before
  // using either the monthly divisor or any saved tariff for this month.
  if (months[month]?.basis === "gross") return null;
  // A saved monthly salary always uses that exact month's official divisor.
  // Explicit amounts from imported files remain usable when no salary is known.
  return hourlyRate(months[month], month) ?? entry.rates?.[month] ?? entry.rate;
}
export const LABOUR_CODE_URL = "https://e-qanun.az/framework/46943";
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
/** Each calendar day uses its own month's tariff; 24:00 is end-of-day only. */
export function dailyEntries(
  entries: Entry[],
  months?: AppData["months"],
): Entry[] {
  return entries.flatMap((entry) => {
    if (entry.sourceId) return [entry];
    const start = timeMinutes(entry.start);
    const end = timeMinutes(entry.end, true);
    if (end > start || end === 0) return [entry];
    const elapsed = 1440 - start + end;
    // Legacy breaks have no position. Allocate their minutes proportionally.
    const firstBreak = Math.round(
      (entry.breakMinutes * (1440 - start)) / elapsed,
    );
    const tomorrow = new Date(Date.parse(`${entry.date}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
    const make = (
      date: string,
      from: string,
      to: string,
      pause: number,
    ): Entry => ({
      ...entry,
      id: `${entry.id}@${date}`,
      sourceId: entry.id,
      date,
      start: from,
      end: to,
      breakMinutes: pause,
      rate:
        hourlyRate(months?.[date.slice(0, 7)], date.slice(0, 7)) ??
        entry.rates?.[date.slice(0, 7)] ??
        (date.slice(0, 7) === entry.date.slice(0, 7) ? entry.rate : null),
    });
    return [
      make(entry.date, entry.start, "24:00", firstBreak),
      make(tomorrow, "00:00", entry.end, entry.breakMinutes - firstBreak),
    ].filter(
      (part) =>
        timeMinutes(part.end, true) - timeMinutes(part.start) >
        part.breakMinutes,
    );
  });
}
export function calculationParts(entry: Entry, months: AppData["months"]) {
  return dailyEntries([entry], months).map((part) => {
    const rate = entryRate(part, months);
    const minutes = durationMinutes(part);
    const base =
      rate === null
        ? null
        : roundMoney((minutes / 60) * rate * part.multiplier);
    return {
      entry: part,
      month: part.date.slice(0, 7),
      minutes,
      norm: getWorkNorm(part.date.slice(0, 7))?.hours ?? null,
      rate,
      base,
      total: base,
    };
  });
}
export function amount(entry: Entry, months: AppData["months"]): number | null {
  const parts = calculationParts(entry, months);
  return parts.some((part) => part.total === null)
    ? null
    : roundMoney(parts.reduce((sum, part) => sum + part.total!, 0));
}
export function formatDuration(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function money(value: number): string {
  // Some Chromium builds lack Azerbaijani ICU data. Keep the AZ decimal comma consistent.
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/,/g, "\u00a0")
    .replace(".", ",");
}
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}
export function displayDate(date: string): string {
  return date.split("-").reverse().join(".");
}
export function newEntry(profile: Profile, date = localDate()): Entry {
  return {
    id: crypto.randomUUID(),
    date,
    start: "18:00",
    end: "20:00",
    breakMinutes: 0,
    multiplier: 2,
    ...profile,
    dayStatus: "qeyri-iş saatı",
    subject: "",
    reason: "",
    rate: null,
  };
}
function interval(entry: Entry): [number, number] {
  const day = Date.parse(`${entry.date}T00:00:00Z`) / 60000;
  const start = day + timeMinutes(entry.start);
  let end = day + timeMinutes(entry.end, true);
  if (end <= start) end += 1440;
  return [start, end];
}
export function overlaps(entry: Entry, others: Entry[]): boolean {
  const [start, end] = interval(entry);
  return others.some((other) => {
    if (
      other.id === entry.id ||
      other.employee.trim().toLocaleLowerCase("az") !==
        entry.employee.trim().toLocaleLowerCase("az")
    )
      return false;
    const [a, b] = interval(other);
    return start < b && end > a;
  });
}
export function fingerprint(entry: Entry): string {
  // A rate assigned after importing an unpriced row does not make it a new work record.
  const {
    id: _id,
    rate: _rate,
    rates: _rates,
    sourceId: _sourceId,
    nightPercent,
    ...rest
  } = entry;
  const normalized = {
    ...rest,
    end: rest.end === "00:00" ? "24:00" : rest.end,
  };
  return JSON.stringify(
    Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b)),
  );
}
const textFields = [
  "employee",
  "manager",
  "customer",
  "project",
  "dayStatus",
  "environment",
  "subject",
  "reason",
] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Faylın məlumat strukturu düzgün deyil.");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 10000)
    throw new Error(`${label}: mətn formatı düzgün deyil.`);
  return value;
}
export function validateEntry(value: unknown): Entry {
  const row = object(value);
  const result = {
    id: text(row.id, "ID"),
    date: text(row.date, "Tarix"),
    start: text(row.start, "Başlanma"),
    end: text(row.end, "Bitmə"),
    breakMinutes: row.breakMinutes,
    multiplier: row.multiplier,
    rate: row.rate,
  } as Entry;
  for (const key of textFields) result[key] = text(row[key], key);
  if (!result.id || result.id.length > 200 || !isDate(result.date))
    throw new Error("Qeydin ID-si və ya tarixi düzgün deyil.");
  if (![1, 2, 3].includes(result.multiplier))
    throw new Error("Əmsal 1, 2 və ya 3 olmalıdır.");
  if (
    result.rate !== null &&
    (typeof result.rate !== "number" ||
      !Number.isFinite(result.rate) ||
      result.rate < 0 ||
      result.rate > 1e9)
  )
    throw new Error("Saatlıq tarif düzgün deyil.");
  if (row.nightPercent !== undefined) {
    if (
      typeof row.nightPercent !== "number" ||
      !Number.isFinite(row.nightPercent) ||
      row.nightPercent < 0 ||
      row.nightPercent > 1000
    )
      throw new Error("Gecə əlavəsi 0–1000% aralığında olmalıdır.");
    result.nightPercent = row.nightPercent;
  }
  if (row.rates !== undefined) {
    result.rates = {};
    for (const [month, rate] of Object.entries(object(row.rates))) {
      if (
        !isMonth(month) ||
        typeof rate !== "number" ||
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 1e9
      )
        throw new Error("Aylıq tarif düzgün deyil.");
      result.rates[month] = rate;
    }
  }
  durationMinutes(result);
  return result;
}
export function validateData(value: unknown): AppData {
  const data = object(value);
  if (
    data.version !== 1 ||
    !Array.isArray(data.entries) ||
    data.entries.length > 50000
  )
    throw new Error(
      "Dəstəklənən v1 JSON ehtiyat nüsxəsi seçin (ən çox 50 000 qeyd).",
    );
  const profile = object(data.profile);
  const result = emptyData();
  for (const key of Object.keys(emptyProfile) as (keyof Profile)[])
    result.profile[key] = text(profile[key], key);
  for (const [month, raw] of Object.entries(object(data.months))) {
    const config = object(raw);
    if (
      !isMonth(month) ||
      typeof config.salary !== "number" ||
      !Number.isFinite(config.salary) ||
      config.salary < 0 ||
      config.salary > 1e9 ||
      typeof config.hours !== "number" ||
      !Number.isFinite(config.hours) ||
      config.hours <= 0 ||
      config.hours > 744
    )
      throw new Error("Aylıq maaş və ya norma saatı düzgün deyil.");
    if (
      config.basis !== undefined &&
      config.basis !== "net" &&
      config.basis !== "gross"
    )
      throw new Error("Maaşın növü düzgün deyil.");
    result.months[month] = {
      salary: config.salary,
      ...(config.basis ? { basis: config.basis as "net" | "gross" } : {}),
      hours: getWorkNorm(month)?.hours ?? config.hours,
    };
  }
  result.entries = data.entries.map(validateEntry);
  if (
    new Set(result.entries.map((entry) => entry.id)).size !==
    result.entries.length
  )
    throw new Error("JSON faylında təkrarlanan qeyd ID-si var.");
  return result;
}
export function mergeData(
  current: AppData,
  imported: AppData,
  options: { matchByWork?: boolean } = {},
): { data: AppData; added: number; skipped: number } {
  // The company Excel format has no multiplier. Match its work fields while
  // retaining the existing record's payment settings. JSON keeps exact matching.
  const matchKey = (entry: Entry) =>
    fingerprint(options.matchByWork ? { ...entry, multiplier: 1 } : entry);
  const seen = new Set(current.entries.map(matchKey));
  const dailySeen = new Set(dailyEntries(current.entries).map(matchKey));
  const ids = new Set(current.entries.map((e) => e.id));
  const months = { ...imported.months, ...current.months };
  const added: Entry[] = [];
  for (const raw of imported.entries) {
    // Freeze the imported month's original rate before keeping the current month's settings.
    const key = raw.date.slice(0, 7);
    const entry = {
      ...raw,
      rate:
        raw.rate ??
        hourlyRate(imported.months[key] ?? current.months[key], key),
    };
    const parts = dailyEntries([entry], imported.months);
    if (
      seen.has(matchKey(entry)) ||
      parts.every((part) => dailySeen.has(matchKey(part)))
    )
      continue;
    // A previously imported monthly report may contain only one side of a shift.
    // Add its missing side without duplicating the already imported hours.
    const candidates = parts.some((part) => dailySeen.has(matchKey(part)))
      ? parts.filter((part) => !dailySeen.has(matchKey(part)))
      : [entry];
    for (const candidate of candidates) {
      const { sourceId: _source, ...saved } = candidate;
      if (_source || ids.has(saved.id)) saved.id = crypto.randomUUID();
      ids.add(saved.id);
      added.push(saved);
    }
    parts.forEach((part) => dailySeen.add(matchKey(part)));
    seen.add(matchKey(entry));
  }
  return {
    data: { ...current, months, entries: [...current.entries, ...added] },
    added: added.length,
    skipped: imported.entries.length - added.length,
  };
}
