// Transcribed from the ministry's published calendar images and checked against
// each official annual total. This snapshot also works without network access.
// Never extrapolate missing years from weekdays: holidays and transferred days vary.
export const CALENDAR_INDEX_URL =
  "https://sosial.gov.az/az/faydali/istehsalat-teqvimi";
export const CALENDAR_VERIFIED_ON = "2026-11-04";
export const WORK_SCHEDULE = "Beşgünlük, həftədə 40 saat";
export const OFFICIAL_CALENDARS: Record<
  number,
  {
    hours: readonly number[];
    annualHours: number;
    sourceUrl: string;
    imageUrl: string;
  }
> = {
  2023: {
    hours: [143, 160, 135, 143, 167, 142, 168, 184, 168, 176, 159, 168],
    annualHours: 1913,
    sourceUrl: `${CALENDAR_INDEX_URL}/2023-cu-ilin-istehsalat-teqvimi`,
    imageUrl: "https://sosial.gov.az/storage/uploads/dass_1733290932.jpg",
  },
  2024: {
    hours: [151, 159, 118, 159, 166, 126, 184, 176, 168, 184, 151, 159],
    annualHours: 1901,
    sourceUrl: `${CALENDAR_INDEX_URL}/2024-cu-ilin-istehsalat-teqvimi`,
    imageUrl: "https://sosial.gov.az/storage/uploads/2024_1733234098.jpg",
  },
  2025: {
    hours: [143, 160, 110, 168, 158, 134, 184, 168, 176, 184, 143, 175],
    annualHours: 1903,
    sourceUrl: `${CALENDAR_INDEX_URL}/2025-ci-ilin-istehsalat-teqvimi`,
    imageUrl: "https://sosial.gov.az/storage/uploads/2025_1741849279.webp",
  },
  2026: {
    hours: [151, 160, 111, 176, 134, 159, 184, 168, 176, 176, 152, 175],
    annualHours: 1922,
    sourceUrl: `${CALENDAR_INDEX_URL}/2026-ci-ilin-istehsalat-teqvimi`,
    imageUrl: "https://sosial.gov.az/storage/articles/1851219871797286.jpg",
  },
};
export function getWorkNorm(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  const calendar = OFFICIAL_CALENDARS[year];
  return calendar
    ? {
        hours: calendar.hours[Number(month.slice(5)) - 1],
        year,
        sourceUrl: calendar.sourceUrl,
        imageUrl: calendar.imageUrl,
        verifiedOn: CALENDAR_VERIFIED_ON,
        schedule: WORK_SCHEDULE,
      }
    : null;
}
