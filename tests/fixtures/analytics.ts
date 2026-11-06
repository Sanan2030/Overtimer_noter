import {
  AppData,
  emptyData,
  emptyProfile,
  Entry,
  newEntry,
} from "../../src/lib/model";
export function analyticsFixture(): AppData {
  const data = emptyData();
  for (let month = 5; month <= 10; month++)
    data.months[`2026-${String(month).padStart(2, "0")}`] = {
      salary: 1320,
      hours: 176,
      basis: "net",
    };
  const add = (
    date: string,
    start: string,
    end: string,
    project: string,
    multiplier: Entry["multiplier"] = 2,
    dayStatus = "qeyri-iş saatı",
  ) => {
    data.entries.push({
      ...newEntry({ ...emptyProfile, employee: "Əməkdaş", project }, date),
      start,
      end,
      multiplier,
      dayStatus,
      subject: `${project} üzrə iş`,
    });
  };
  add("2026-05-05", "00:00", "12:00", "AzDoc 3.0");
  add("2026-06-05", "00:00", "16:00", "AzDoc 3.0");
  add("2026-07-05", "00:00", "10:00", "AzDoc 3.0");
  add("2026-08-05", "00:00", "22:00", "AzDoc 3.0");
  add("2026-09-02", "18:00", "22:00", "AzDoc 3.0");
  add("2026-09-09", "18:00", "22:00", "AzDoc 3.0");
  add("2026-09-16", "18:00", "22:00", "Daxili işlər");
  add("2026-09-23", "16:00", "22:00", "Digər");
  add("2026-10-01", "18:00", "22:00", "Daxili işlər", 1);
  add("2026-10-05", "18:00", "22:00", "Digər", 3, "istirahət günü");
  add("2026-10-09", "14:00", "22:00", "AzDoc 3.0");
  add("2026-10-16", "16:00", "22:00", "AzDoc 3.0");
  add("2026-10-30", "18:00", "20:00", "Daxili işlər");
  return data;
}
