// Cross-vertical user journey against LIVE finn.no. Not CI-stable by nature
// (depends on two live listings); run before every release: npm run e2e:live
import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";

const TORGET_URL = "https://www.finn.no/recommerce/forsale/item/466564665";
const MC_URL = "https://www.finn.no/mobility/item/465836254";

let context: BrowserContext;
let extensionId: string;

async function clickFollow(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const walk = (root: ParentNode): HTMLElement | null => {
      for (const el of root.querySelectorAll("*")) {
        if (el.id === "torgvakt-btn") return el as HTMLElement;
        if (el.shadowRoot) {
          const hit = walk(el.shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    };
    const btn = walk(document);
    if (!btn) return null;
    btn.click();
    return btn.textContent;
  });
}

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
});

test.afterAll(async () => context.close());

test("track torget + mc, popup shows both, untrack mc keeps torget", async () => {
  test.setTimeout(90000);

  const torget = await context.newPage();
  await torget.goto(TORGET_URL, { waitUntil: "domcontentloaded" });
  await torget.waitForTimeout(2500);
  expect(await clickFollow(torget)).toBe("Følg pris");
  await torget.waitForTimeout(800);

  const mc = await context.newPage();
  await mc.goto(MC_URL, { waitUntil: "domcontentloaded" });
  await mc.waitForTimeout(2500);
  expect(await clickFollow(mc)).toBe("Følg pris");
  await mc.waitForTimeout(800);

  const popup = await context.newPage();
  const errors: string[] = [];
  popup.on("pageerror", (e) => errors.push(e.message));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator(".tv-item")).toHaveCount(2);
  await expect(popup.locator("#tv-count")).toHaveText("2 fulgt");
  expect(errors).toEqual([]);

  // untrack the MC entry (newest first, so it is the first row)
  await popup.locator(".tv-remove").first().click();
  await expect(popup.locator(".tv-item")).toHaveCount(1);
  await expect(popup.locator(".tv-mid a").first()).toContainText("TRIACLE");
});
