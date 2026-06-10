import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  const dist = path.resolve("dist");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  const [worker] = context.serviceWorkers().length
    ? context.serviceWorkers()
    : [await context.waitForEvent("serviceworker")];
  extensionId = new URL(worker.url()).host;
  await worker.evaluate(() =>
    chrome.storage.local.set({
      tracked: {
        "42": {
          id: "42", url: "https://www.finn.no/recommerce/forsale/item/42",
          title: "Testsykkel", image: "", addedAt: 1, status: "active",
          history: [{ ts: 1, price: 1000 }, { ts: 2, price: 750 }],
        },
      },
    }),
  );
});

test.afterAll(async () => context.close());

test("popup lists seeded listing with price and change", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator(".tv-item")).toHaveCount(1);
  await expect(page.locator(".tv-mid a")).toHaveText("Testsykkel");
  await expect(page.locator(".tv-priceline strong")).toHaveText("750 kr");
  await expect(page.locator(".tv-change")).toContainText("-250");
});

test("untrack removes item and shows empty state", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.locator(".tv-remove").click();
  await expect(page.locator(".tv-item")).toHaveCount(0);
  await expect(page.locator("#tv-empty")).toBeVisible();
});
