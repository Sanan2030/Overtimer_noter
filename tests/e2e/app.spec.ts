import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

async function setSalary(page: Page, month = "2026-10", salary = "1320") {
  await page.getByRole("button", { name: "Aylıq maaş", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ay", { exact: true }).fill(month);
  await dialog.getByLabel("Net maaş (AZN)").fill(salary);
  await expect(dialog.locator(".norm-note")).toContainText("saat");
  await expect(dialog.locator('input[type="number"]')).toHaveCount(1);
  await dialog.getByRole("button", { name: "Ayarları saxla" }).click();
  await expect(dialog).not.toBeVisible();
}
async function addEntry(
  page: Page,
  subject = "PROD üçün test",
  multiplier = 1,
) {
  await page.getByRole("button", { name: "Yeni qeyd", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mövzu", { exact: true }).fill(subject);
  await dialog
    .getByRole("button", { name: `${multiplier}x`, exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
test("calculates overtime, persists after reload and exports a complete JSON backup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await setSalary(page);
  await addEntry(page);
  const row = page.getByRole("row").filter({ hasText: "PROD üçün test" });
  await expect(row).toContainText("15,00");
  await page.reload();
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  await expect(row).toBeVisible();
  await expect(row).toContainText("02:00");
  await page.getByRole("button", { name: "Fayllar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON endir", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.entries).toHaveLength(1);
  expect(backup.months["2026-10"]).toEqual({
    salary: 1320,
    hours: 176,
    basis: "net",
  });
  expect(errors).toEqual([]);
});

test("imports original Excel, prices old records, exports matching columns and skips repeats", async ({
  page,
}) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Oktyabr");
  sheet.addRow([
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
  ]);
  sheet.addRow([
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
    "NMR AzDoc — PROD üçün hazırlanma/test",
    "Test",
  ]);
  const buffer = Buffer.from(
    (await workbook.xlsx.writeBuffer()) as ArrayBuffer,
  );
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "oktyabr.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByRole("dialog")).toContainText("1 yeni qeyd");
  await page.getByRole("button", { name: "Qeydləri idxal et" }).click();
  const row = page.getByRole("row").filter({ hasText: "NMR AzDoc" });
  await expect(row).toContainText("Tarif yoxdur");
  await setSalary(page);
  await expect(row).toContainText("22,50");
  await page.locator('input[type="file"]').setInputFiles({
    name: "oktyabr.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByRole("dialog")).toContainText("0 yeni qeyd");
  await page.getByRole("button", { name: "Qeydləri idxal et" }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await row.getByRole("button", { name: /qeydini redaktə et/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "3x", exact: true })
    .click();
  await page.getByRole("button", { name: "Dəyişiklikləri saxla" }).click();
  await expect(row).toContainText("67,50");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel ixrac et" }).click();
  const download = await downloadPromise;
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.readFile((await download.path())!);
  expect(exported.worksheets).toHaveLength(1);
  const exportedSheet = exported.getWorksheet("Overtime")!;
  expect(exportedSheet.columnCount).toBe(14);
  expect(exportedSheet.rowCount).toBe(2);
  expect(exportedSheet.getCell("M1").value).toBe("Mövzu");
  expect(exportedSheet.getCell("C2").value).toBe("İnci Məmmədzadə");
  await page.locator('input[type="file"]').setInputFiles({
    name: "yeniden.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await readFile((await download.path())!),
  });
  await expect(page.getByRole("dialog")).toContainText("0 yeni qeyd");
  await page.getByRole("button", { name: "Qeydləri idxal et" }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(row).toContainText("67,50");
});

test("JSON restore survives navigation and repeated imports, each browser starts isolated", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Ehtiyat nüsxə qeydi", 2);
  await page.getByRole("button", { name: "Fayllar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON endir", exact: true }).click();
  const download = await downloadPromise;
  const backup = await readFile((await download.path())!);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("http://127.0.0.1:3000");
  await expect(
    otherPage.getByText("Hələ qeyd yoxdur", { exact: true }),
  ).toBeVisible();
  await otherPage.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await otherPage.getByRole("button", { name: "Qeydləri idxal et" }).click();
  await expect(
    otherPage.getByRole("row").filter({ hasText: "Ehtiyat nüsxə qeydi" }),
  ).toContainText("30,00");
  await otherPage.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect(otherPage.getByRole("dialog")).toContainText("0 yeni qeyd");
  await otherPage.getByRole("button", { name: "Qeydləri idxal et" }).click();
  await expect(otherPage.getByRole("row")).toHaveCount(2);
  await other.close();
});

test("editing, overlapping times, filters and deletion behave correctly", async ({
  page,
}) => {
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Birinci qeyd");
  await page.getByRole("button", { name: /qeydini redaktə et/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Bitmə", { exact: true }).fill("21:00");
  await dialog.getByRole("button", { name: "3x", exact: true }).click();
  await dialog.getByRole("button", { name: "Dəyişiklikləri saxla" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Birinci qeyd" }),
  ).toContainText("67,50");
  await page.getByRole("button", { name: "Qeydi kopyala" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Vaxt aralığı üst-üstə düşür", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Mövzu", { exact: true }).fill("İkinci qeyd");
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Yenə də bu qeydi saxlamaq istəyirəm").check();
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await page.getByRole("button", { name: "Qeydlərim", exact: true }).click();
  await page.getByLabel("Qeydlərdə axtar").fill("İkinci");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: /qeydini sil/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Qeydi sil", exact: true })
    .click();
  await expect(
    page.getByText("Uyğun qeyd tapılmadı", { exact: true }),
  ).toBeVisible();
});

test("official monthly norms reprice only the selected month's records", async ({
  page,
}) => {
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Oktyabr işi");
  await setSalary(page, "2026-03", "1110");
  await addEntry(page, "Mart işi");
  await setSalary(page, "2026-10", "1760");
  await page.getByLabel("Hesabat dövrü").selectOption("all");
  await expect(
    page.getByRole("row").filter({ hasText: "Oktyabr işi" }),
  ).toContainText("20,00");
  await expect(
    page.getByRole("row").filter({ hasText: "Mart işi" }),
  ).toContainText("20,00");
});

test("mobile layout has no page overflow and supports a new overnight record", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await setSalary(page);
  await page.getByRole("button", { name: "Yeni qeyd", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Başlanma", { exact: true }).fill("22:00");
  await dialog.getByLabel("Bitmə", { exact: true }).fill("02:00");
  await expect(dialog.getByLabel("Fasilə (dəqiqə)")).toHaveCount(0);
  await expect(dialog.getByLabel("Gecə əlavəsi (%)")).toHaveCount(0);
  await dialog.getByRole("button", { name: "2x", exact: true }).click();
  await dialog.getByLabel("Mövzu", { exact: true }).fill("Gecə işi");
  await expect(dialog).toContainText("60,00");
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Gecə işi" }),
  ).toHaveCount(2);
  await expect(page.locator(".record-summary-inline")).toContainText("60,00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Analiz", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByText("Daha ətraflı analiz", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Həftənin günləri" }),
  ).toBeVisible();
});

test("malformed imports never overwrite existing records and replacement requires consent", async ({
  page,
}) => {
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Qorunan qeyd");
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "JSON faylı oxunmur" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Qorunan qeyd" }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        profile: {
          employee: "",
          manager: "",
          customer: "",
          project: "",
          environment: "ofis şəraiti",
        },
        months: {},
        entries: [],
      }),
    ),
  });
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("radio", { name: /Bütün məlumatları fayldakı ilə əvəz et/ })
    .check();
  await expect(
    dialog.getByRole("button", { name: "Əvəz et və bərpa et" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Ləğv et" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Qorunan qeyd" }),
  ).toBeVisible();
});

test("blocked browser storage warns clearly and JSON can still rescue in-memory data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Yaddaş dolu olduqda qeyd");
  await expect(page.locator(".storage-warning")).toContainText(
    "Dəyişiklik brauzerdə saxlanmadı",
  );
  await expect(page.locator(".save-status")).toContainText("Saxlanmayıb");
  await page.getByRole("button", { name: "Fayllar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".data-card")
    .getByRole("button", { name: "JSON endir", exact: true })
    .click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.entries[0].subject).toBe("Yaddaş dolu olduqda qeyd");
  expect(backup.months["2026-10"].salary).toBe(1320);
});

test("corrupt stored data is preserved until an explicitly confirmed restore", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("overtime-noter:v1"))
      localStorage.setItem("overtime-noter:v1", "{broken-original");
  });
  await page.goto("/");
  await expect(page.locator(".storage-warning")).toContainText(
    "Orijinal nüsxə qorunur",
  );
  await expect(
    page.getByRole("button", { name: "Yeni qeyd", exact: true }),
  ).toBeDisabled();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".storage-warning")
    .getByRole("button", { name: "JSON endir", exact: true })
    .click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "{broken-original",
  );
  const backup = {
    version: 1,
    profile: {
      employee: "",
      manager: "",
      customer: "",
      project: "",
      environment: "ofis şəraiti",
    },
    months: {},
    entries: [],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Əvəz et və bərpa et" }).click();
  await expect(page.locator(".storage-warning")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Yeni qeyd", exact: true }),
  ).toBeEnabled();
});

test("March salary uses 111 official hours and all record fields are in one window", async ({
  page,
}) => {
  await page.goto("/");
  await setSalary(page, "2026-03", "1200");
  await page.getByRole("button", { name: "Yeni qeyd", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".norm-note")).toContainText("111 saat");
  await expect(dialog.getByLabel("Əməkdaş", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Şöbə müdiri", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Layihə", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Fasilə (dəqiqə)")).toHaveCount(0);
  await expect(dialog.getByLabel("Gecə əlavəsi (%)")).toHaveCount(0);
  await expect(dialog.locator("details")).toHaveCount(0);
  await dialog.getByLabel("Mövzu", { exact: true }).fill("Mart norması");
  await expect(dialog.locator(".calculation")).toContainText("43,24");
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Mart norması" }),
  ).toContainText("43,24");
});

test("dark mode is saved and applies to forms without affecting records", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Tünd rejimə keç", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await setSalary(page);
  await addEntry(page, "Tünd rejimdə qeyd");
  await expect(
    page.getByRole("row").filter({ hasText: "Tünd rejimdə qeyd" }),
  ).toContainText("15,00");
  await page
    .getByRole("button", { name: "Açıq rejimə keç", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("month-end shift is split into 5 October hours and 2 November hours using each month's net salary without night pay", async ({
  page,
}) => {
  await page.goto("/");
  await setSalary(page, "2026-10", "1320");
  await page.getByRole("button", { name: "Yeni qeyd", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tarix", { exact: true }).fill("2026-10-31");
  await dialog.getByLabel("Başlanma", { exact: true }).fill("19:00");
  await dialog.getByLabel("Bitmə", { exact: true }).fill("02:00");
  await dialog.getByLabel("Mövzu", { exact: true }).fill("Aylararası iş");
  await dialog.getByLabel("Tarix", { exact: true }).fill("");
  await expect(dialog).toContainText("Düzgün tarix seç.");
  await dialog.getByLabel("Tarix", { exact: true }).fill("2026-10-31");
  await expect(
    dialog.getByRole("button", { name: "2x", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator(".pay-breakdown")).toContainText("75,00");
  await expect(dialog.locator(".pay-breakdown")).toContainText("Tarif yoxdur");
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await setSalary(page, "2026-11", "1320");
  let row = page.getByRole("row").filter({ hasText: "Aylararası iş" });
  await expect(row).toContainText("01.11.2026");
  await expect(row).toContainText("02:00");
  await expect(row).toContainText("34,74");
  await row.getByRole("button", { name: /qeydini redaktə et/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Tarix", { exact: true })).toHaveValue(
    "2026-10-31",
  );
  await expect(dialog.locator(".calculation")).toContainText("109,74");
  await dialog.getByRole("button", { name: "Ləğv et", exact: true }).click();
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  await expect(row).toContainText("05:00");
  await expect(row).toContainText("75,00");
  await page.getByLabel("Hesabat dövrü").selectOption("all");
  await expect(row).toHaveCount(2);
  await expect(page.locator(".record-summary-inline")).toContainText("109,74");
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("overtime-noter:v1")!),
  );
  expect(stored.entries).toHaveLength(1);
  expect(stored.entries[0].date).toBe("2026-10-31");
  await page.getByLabel("Hesabat dövrü").selectOption("2026-11");
  await page
    .getByRole("row")
    .filter({ hasText: "Aylararası iş" })
    .getByRole("button", { name: /qeydini sil/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Qeydi sil", exact: true })
    .click();
  await page.getByLabel("Hesabat dövrü").selectOption("all");
  await expect(
    page.getByRole("row").filter({ hasText: "Aylararası iş" }),
  ).toHaveCount(0);
});

test("a legacy net salary is retained and prefilled for editing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "overtime-noter:v1",
      JSON.stringify({
        version: 1,
        profile: {
          employee: "",
          manager: "",
          customer: "",
          project: "",
          environment: "ofis şəraiti",
        },
        months: { "2026-10": { salary: 1320, hours: 176 } },
        entries: [],
      }),
    );
  });
  await page.goto("/");
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  await expect(page.locator(".salary-button")).toContainText("net");
  await page.getByRole("button", { name: "Aylıq maaş", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Net maaş (AZN)")).toHaveValue("1320");
  await dialog.getByRole("button", { name: "Ləğv et", exact: true }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("overtime-noter:v1")!),
  );
  expect(stored.months["2026-10"]).toEqual({ salary: 1320, hours: 176 });
});

test("saved gross salary waits for net input and reprices overtime from the entered net salary", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("overtime-noter:v1")) return;
    const profile = {
      employee: "",
      manager: "",
      customer: "",
      project: "",
      environment: "ofis şəraiti",
    };
    localStorage.setItem(
      "overtime-noter:v1",
      JSON.stringify({
        version: 1,
        profile,
        months: { "2026-10": { salary: 1320, hours: 176, basis: "gross" } },
        entries: [
          {
            ...profile,
            id: "gross-entry",
            date: "2026-10-02",
            start: "18:00",
            end: "20:00",
            breakMinutes: 0,
            multiplier: 2,
            dayStatus: "qeyri-iş saatı",
            subject: "Net maaşla hesabla",
            reason: "Test",
            rate: 7.5,
            nightPercent: 20,
          },
        ],
      }),
    );
  });
  await page.goto("/");
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  const row = page.getByRole("row").filter({ hasText: "Net maaşla hesabla" });
  await expect(row).toContainText("Tarif yoxdur");
  await page.getByRole("button", { name: "Aylıq maaş", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Əvvəlki brutto maaş");
  await expect(dialog.getByLabel("Net maaş (AZN)")).toHaveValue("");
  await dialog.getByLabel("Net maaş (AZN)").fill("880");
  await expect(dialog.locator(".rate-preview")).toContainText("5,00");
  await dialog.getByRole("button", { name: "Ayarları saxla" }).click();
  await expect(row).toContainText("20,00");
  await page.reload();
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  await expect(row).toContainText("20,00");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("overtime-noter:v1")!),
  );
  expect(stored.months["2026-10"]).toEqual({
    salary: 880,
    hours: 176,
    basis: "net",
  });
  expect(stored.entries[0].rate).toBe(5);
});
