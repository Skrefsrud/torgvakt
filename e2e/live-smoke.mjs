// Manual smoke test against live finn.no. Run: npm run smoke -- <listing-url>
// Verifies: content script injects the button on a real listing page.
import { chromium } from "@playwright/test";
import path from "node:path";

const url = process.argv[2] ?? "https://www.finn.no/recommerce/forsale/item/466564665";
const dist = path.resolve("dist");
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#torgvakt-btn", { timeout: 10000 });
console.log("OK: button injected on", url);
await ctx.close();
