import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";

async function setSalary(
  page: Page,
  month = "2026-10",
  salary = "1200",
  hours = "160",
) {
  await page.getByRole("button", { name: "Aylıq maaş", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ay", { exact: true }).fill(month);
  await dialog.getByLabel("Net maaş (AZN)").fill(salary);
  await dialog.getByLabel("Norma iş saatı").fill(hours);
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
  if (multiplier !== 1)
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
  await page.getByRole("button", { name: "Məlumatlar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON endir", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.entries).toHaveLength(1);
  expect(backup.months["2026-10"]).toEqual({ salary: 1200, hours: 160 });
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
  await page
    .locator('input[type="file"]')
    .setInputFiles({
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
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "oktyabr.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
  await expect(page.getByRole("dialog")).toContainText("0 yeni qeyd");
  await page.getByRole("button", { name: "Qeydləri idxal et" }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel ixrac et" }).click();
  const download = await downloadPromise;
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.readFile((await download.path())!);
  expect(exported.worksheets[0].getCell("Q2").value).toBe(22.5);
  expect(exported.worksheets[0].getCell("M1").value).toBe("Mövzu");
  expect(exported.worksheets[1].getCell("B2").value).toBe(1);
});

test("JSON restore survives navigation and repeated imports, each browser starts isolated", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Ehtiyat nüsxə qeydi", 2);
  await page.getByRole("button", { name: "Məlumatlar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON endir", exact: true }).click();
  const download = await downloadPromise;
  const backup = await readFile((await download.path())!);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("http://127.0.0.1:3000");
  await expect(
    otherPage.getByText("İlk saatını qeyd et", { exact: true }),
  ).toBeVisible();
  await otherPage
    .locator('input[type="file"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: backup,
    });
  await otherPage.getByRole("button", { name: "Qeydləri idxal et" }).click();
  await expect(
    otherPage.getByRole("row").filter({ hasText: "Ehtiyat nüsxə qeydi" }),
  ).toContainText("30,00");
  await otherPage
    .locator('input[type="file"]')
    .setInputFiles({
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

test("monthly rate changes preserve history unless explicitly recalculated", async ({
  page,
}) => {
  await page.goto("/");
  await setSalary(page);
  await addEntry(page, "Köhnə tarif");
  await setSalary(page, "2026-10", "1600");
  await expect(
    page.getByRole("row").filter({ hasText: "Köhnə tarif" }),
  ).toContainText("15,00");
  await page.getByRole("button", { name: "Aylıq maaş", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Ayarları saxla" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Köhnə tarif" }),
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
  await dialog.getByLabel("Fasilə (dəqiqə)").fill("30");
  await dialog.getByRole("button", { name: "2x", exact: true }).click();
  await dialog.getByLabel("Mövzu", { exact: true }).fill("Gecə işi");
  await expect(dialog).toContainText("52,50");
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await page.getByRole("button", { name: "Analiz", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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
  await page
    .locator('input[type="file"]')
    .setInputFiles({
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
  await page
    .locator('input[type="file"]')
    .setInputFiles({
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
  await page.getByRole("button", { name: "Məlumatlar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".data-card")
    .getByRole("button", { name: "JSON endir", exact: true })
    .click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.entries[0].subject).toBe("Yaddaş dolu olduqda qeyd");
  expect(backup.months["2026-10"].salary).toBe(1200);
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
  await page
    .locator('input[type="file"]')
    .setInputFiles({
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
