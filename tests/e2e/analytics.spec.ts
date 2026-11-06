import { test, expect, type Page } from "@playwright/test";
import { analyticsFixture } from "../fixtures/analytics";
import type { AppData } from "../../src/lib/model";
async function openReport(page: Page, data: AppData) {
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("overtime-noter:v1", JSON.stringify(data)),
    data,
  );
  await page.reload();
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  await page.getByRole("button", { name: "Analiz", exact: true }).click();
}
test("analytics charts use real records and respond to month, metric and all-time selections", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openReport(page, analyticsFixture());
  await expect(
    page.getByRole("article", { name: "Ümumi əlavə iş", exact: true }),
  ).toContainText("24");
  await expect(
    page.getByRole("article", { name: "Hesablanmış məbləğ", exact: true }),
  ).toContainText("360,00");
  await expect(
    page.getByRole("article", { name: "Orta gündəlik", exact: true }),
  ).toContainText("4s 48d");
  await expect(
    page.getByRole("article", { name: "Əsas əmsal payı", exact: true }),
  ).toContainText("67%");
  await expect(page.getByText("Rəsmi norma:", { exact: false })).toContainText(
    "176 saat",
  );
  const weeks = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Həftəlik əlavə iş yükü",
        exact: true,
      }),
    });
  await expect(weeks).toContainText("26–31 Okt");
  const comparison = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Əvvəlki ayla müqayisə",
        exact: true,
      }),
    });
  await expect(comparison.getByRole("table")).toContainText("+18 dəqiqə");
  const factors = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Əmsallar üzrə bölgü",
        exact: true,
      }),
    });
  const one = factors.getByText("1x əmsal", { exact: true }).locator("../..");
  await expect(one).toContainText("17%");
  await factors.getByRole("button", { name: "Məbləğ", exact: true }).click();
  await expect(one).toContainText("8%");
  await expect(
    factors.getByRole("img", { name: "Əmsallar üzrə məbləğ bölgüsü" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sentyabr 2026: 18:00 saat", exact: true })
    .click();
  await expect(page.getByLabel("Hesabat dövrü")).toHaveValue("2026-09");
  await expect(
    page.getByRole("article", { name: "Ümumi əlavə iş", exact: true }),
  ).toContainText("18");
  await expect(
    page.getByRole("article", { name: "Hesablanmış məbləğ", exact: true }),
  ).toContainText("270,00");
  await page.getByLabel("Hesabat dövrü").selectOption("all");
  await expect(
    page.getByRole("article", { name: "Ümumi əlavə iş", exact: true }),
  ).toContainText("102");
  await expect(
    page.getByText("Müqayisəni görmək üçün konkret ay seç.", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Hesabat dövrü").selectOption("2026-10");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Tünd rejimə keç", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("unpriced analytics keep hours visible and update after adding net salary", async ({
  page,
}) => {
  const data = analyticsFixture();
  delete data.months["2026-10"];
  await openReport(page, data);
  const amount = page.getByRole("article", {
    name: "Hesablanmış məbləğ",
    exact: true,
  });
  await expect(amount).toContainText("—");
  await expect(
    page.getByRole("article", { name: "Ümumi əlavə iş", exact: true }),
  ).toContainText("24");
  await expect(
    page.getByText("Məbləği görmək üçün aylıq net maaşını daxil et", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Maaş əlavə et", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Ay", { exact: true })).toHaveValue("2026-10");
  await dialog.getByLabel("Net maaş (AZN)").fill("1320");
  await dialog
    .getByRole("button", { name: "Ayarları saxla", exact: true })
    .click();
  await expect(amount).toContainText("360,00");
  await expect(
    page.getByText("Məbləği görmək üçün aylıq net maaşını daxil et", {
      exact: true,
    }),
  ).toHaveCount(0);
});
test("empty analytics provide a working new-record action without mock chart data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analiz", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Hələ analiz üçün qeyd yoxdur",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Yeni qeyd əlavə et", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mövzu", { exact: true }).fill("Analizdən yeni qeyd");
  await dialog
    .getByRole("button", { name: "Qeydi saxla", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Ümumi əlavə iş", exact: true }),
  ).toContainText("2");
  await expect(
    page.getByRole("heading", {
      name: "Hələ analiz üçün qeyd yoxdur",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Hesablanmış məbləğ", exact: true }),
  ).toContainText("—");
});
