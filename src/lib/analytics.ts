import {
  amount,
  AppData,
  dailyEntries,
  durationMinutes,
  Entry,
  isMonth,
  localDate,
  roundMoney,
} from "./model";

export type Summary = {
  minutes: number;
  knownAmount: number;
  unpriced: number;
  count: number;
  days: number;
  average: number;
};
type WorkRow = { entry: Entry; minutes: number; cost: number | null };
export type Distribution = Summary & { key: string; label: string };
export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
function summarize(rows: WorkRow[]): Summary {
  const minutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const days = new Set(rows.map((row) => row.entry.date)).size;
  return {
    minutes,
    days,
    average: days ? Math.round(minutes / days) : 0,
    knownAmount: roundMoney(
      rows.reduce((sum, row) => sum + (row.cost ?? 0), 0),
    ),
    unpriced: rows.filter((row) => row.cost === null).length,
    count: rows.length,
  };
}
function group(rows: WorkRow[], key: (entry: Entry) => string): Distribution[] {
  const groups = new Map<string, WorkRow[]>();
  rows.forEach((row) => {
    const name = key(row.entry);
    const bucket = groups.get(name);
    if (bucket) bucket.push(row);
    else groups.set(name, [row]);
  });
  return [...groups].map(([key, values]) => ({
    key,
    label: key,
    ...summarize(values),
  }));
}
export function percentageChange(
  current: number,
  previous: number,
): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
export function buildAnalytics(data: AppData, period: string) {
  const rows: WorkRow[] = dailyEntries(data.entries, data.months).map(
    (entry) => ({
      entry,
      minutes: durationMinutes(entry),
      cost: amount(entry, data.months),
    }),
  );
  const all = !isMonth(period);
  const selected = all
    ? rows
    : rows.filter((row) => row.entry.date.startsWith(period));
  const lastMonth = rows.reduce(
    (latest, row) =>
      row.entry.date.slice(0, 7) > latest ? row.entry.date.slice(0, 7) : latest,
    "",
  );
  const anchor = all ? lastMonth || localDate().slice(0, 7) : period;
  const previousMonth = all ? null : shiftMonth(period, -1);
  const before = previousMonth
    ? rows.filter((row) => row.entry.date.startsWith(previousMonth))
    : [];
  const summary = summarize(selected);
  const previous = summarize(before);
  const trend = Array.from({ length: 6 }, (_, index) => {
    const month = shiftMonth(anchor, index - 5);
    return {
      month,
      ...summarize(rows.filter((row) => row.entry.date.startsWith(month))),
    };
  });
  const projects = group(
    selected,
    (entry) => entry.project.trim() || "Layihəsiz",
  ).sort(
    (a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label, "az"),
  );
  const previousProjects = group(
    before,
    (entry) => entry.project.trim() || "Layihəsiz",
  );
  const multipliers = ([1, 2, 3] as const).map((multiplier) => ({
    key: String(multiplier),
    label: `${multiplier}x`,
    multiplier,
    ...summarize(selected.filter((row) => row.entry.multiplier === multiplier)),
  }));
  const dominant = [...multipliers].sort(
    (a, b) => b.minutes - a.minutes || a.multiplier - b.multiplier,
  )[0];
  const weeks: (Summary & {
    start: number;
    end: number;
    regular: number;
    special: number;
  })[] = [];
  if (!all) {
    const [year, month] = period.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let start = 1; start <= lastDay; ) {
      const weekday =
        (new Date(Date.UTC(year, month - 1, start)).getUTCDay() + 6) % 7;
      const end = Math.min(lastDay, start + 6 - weekday);
      const week = selected.filter((row) => {
        const day = Number(row.entry.date.slice(8));
        return day >= start && day <= end;
      });
      const special = week
        .filter((row) =>
          /istirahət|bayram/.test(row.entry.dayStatus.toLocaleLowerCase("az")),
        )
        .reduce((sum, row) => sum + row.minutes, 0);
      const total = summarize(week);
      weeks.push({
        start,
        end,
        ...total,
        special,
        regular: total.minutes - special,
      });
      start = end + 1;
    }
  }
  const missingMonths = [
    ...new Set(
      selected
        .filter((row) => row.cost === null)
        .map((row) => row.entry.date.slice(0, 7)),
    ),
  ].sort();
  return {
    all,
    anchor,
    previousMonth,
    summary,
    previous,
    trend,
    projects,
    previousProjects,
    multipliers,
    dominant,
    weeks,
    missingMonths,
    entries: selected.map((row) => row.entry),
  };
}
