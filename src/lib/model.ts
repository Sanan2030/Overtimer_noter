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
export type MonthConfig = { salary: number; hours: number };
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
export function timeMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Saat HH:MM formatında olmalıdır.");
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function durationMinutes(
  entry: Pick<Entry, "start" | "end" | "breakMinutes">,
): number {
  const start = timeMinutes(entry.start),
    end = timeMinutes(entry.end);
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
  const hours = month ? getWorkNorm(month)?.hours : config?.hours;
  return config && hours && hours > 0 ? config.salary / hours : null;
}
export function entryRate(
  entry: Entry,
  months: AppData["months"],
): number | null {
  const month = entry.date.slice(0, 7);
  // A saved monthly salary always uses that exact month's official divisor.
  // Explicit amounts from imported files remain usable when no salary is known.
  return hourlyRate(months[month], month) ?? entry.rate;
}
export function amount(entry: Entry, months: AppData["months"]): number | null {
  const rate = entryRate(entry, months);
  return rate === null
    ? null
    : Math.round(
        ((durationMinutes(entry) / 60) * rate * entry.multiplier +
          Number.EPSILON) *
          100,
      ) / 100;
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
    multiplier: 1,
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
  let end = day + timeMinutes(entry.end);
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
  const { id: _id, rate: _rate, ...rest } = entry;
  return JSON.stringify(
    Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)),
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
    result.months[month] = {
      salary: config.salary,
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
): { data: AppData; added: number; skipped: number } {
  const seen = new Set(current.entries.map(fingerprint));
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
    if (seen.has(fingerprint(entry))) continue;
    seen.add(fingerprint(entry));
    if (ids.has(entry.id)) entry.id = crypto.randomUUID();
    ids.add(entry.id);
    added.push(entry);
  }
  return {
    data: { ...current, months, entries: [...current.entries, ...added] },
    added: added.length,
    skipped: imported.entries.length - added.length,
  };
}
