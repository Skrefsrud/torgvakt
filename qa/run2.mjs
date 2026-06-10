// Phase 2: mobility (MC, private car, boat, dealer car), sold listings, emoji title,
// 6+ tracked, untrack from popup and from page, inline history widget.
import { launch, getTracked, probeButton, clickButton, visitListing, checkPopup } from "./helpers.mjs";
import fs from "node:fs";

const log = (tag, data) => {
  const line = JSON.stringify({ tag, ...data });
  console.log(line);
  fs.appendFileSync("/home/glinux/Projects/torgvakt/qa/results.jsonl", line + "\n");
};

const { ctx, sw, extId } = await launch();

// Shadow-piercing text scan for given regexes.
const TEXT_SCAN = `((res) => {
  const hits = {};
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.children.length === 0 && el.textContent) {
        const t = el.textContent.trim();
        for (const [k, re] of Object.entries(res)) {
          if (new RegExp(re, "i").test(t) && !(k in hits)) hits[k] = { tag: el.tagName, text: t.slice(0, 120) };
        }
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return hits;
})`;

const LISTINGS = [
  { name: "mobility-mc", url: "https://www.finn.no/mobility/item/351790087", follow: true },
  { name: "mobility-car-private", url: "https://www.finn.no/mobility/item/372698519", follow: true },
  { name: "mobility-boat", url: "https://www.finn.no/mobility/item/347593317", follow: true },
  { name: "mobility-car-dealer-1", url: "https://www.finn.no/mobility/item/461060148", follow: true, dealer: true },
  { name: "mobility-car-dealer-2", url: "https://www.finn.no/mobility/item/464066451", follow: true, dealer: true },
  { name: "torget-emoji", url: "https://www.finn.no/recommerce/forsale/item/338298867", follow: true },
  { name: "torget-iphone", url: "https://www.finn.no/recommerce/forsale/item/409559330", follow: true },
  { name: "sold-candidate-bmw-i3", url: "https://www.finn.no/mobility/item/462878485", follow: true, soldCheck: true },
  { name: "sold-candidate-kawasaki", url: "https://www.finn.no/mobility/item/304790876", follow: false, soldCheck: true },
];

for (const t of LISTINGS) {
  const consoleErrors = [];
  const page = await visitListing(ctx, t.url, { consoleErrors });
  const scan = await page.evaluate(`(${TEXT_SCAN})({solgt: "^Solgt$", monthly: "kr/mnd|kr / mnd|pr\\\\. mnd", totalpris: "Totalpris", pris: "^\\\\d[\\\\d\\\\s\\u00a0\\u202f]*kr$"})`).catch((e) => ({ err: String(e) }));
  const btn = await probeButton(page);
  let entry = null, labelAfter = null, hist = null;
  if (btn && t.follow) {
    await clickButton(page);
    await page.waitForTimeout(1200);
    const after = await probeButton(page, 3000);
    labelAfter = after?.label;
    hist = after?.historyText;
    const tracked = await getTracked(sw);
    const id = t.url.match(/item\/(\d+)/)[1];
    entry = tracked[id] ?? null;
  }
  log("listing", { name: t.name, url: t.url, scan, btn, labelAfter, inlineHistory: hist, entry, consoleErrors: consoleErrors.slice(0, 4) });
  await page.close();
  const { page: pp, errors, state } = await checkPopup(ctx, extId);
  log("popup-after", { name: t.name, errors, count: state.count, items: state.items.map((i) => ({ title: i.title, price: i.price, badge: i.badge, spark: i.sparkline?.slice(0, 30), hasRemove: i.hasRemove, broken: i.broken, hasImg: i.hasImg })) });
  await pp.close();
}

// Revisit a tracked listing: button should say "Følges ✓" and inline history should render.
{
  const page = await visitListing(ctx, "https://www.finn.no/recommerce/forsale/item/409559330", {});
  const btn = await probeButton(page);
  log("revisit-tracked", { btn });
  // Untrack from the page button (row 7b).
  await clickButton(page);
  await page.waitForTimeout(1000);
  const after = await probeButton(page, 3000);
  const tracked = await getTracked(sw);
  log("untrack-from-page", { labelAfter: after?.label, stillInStorage: "409559330" in tracked, count: Object.keys(tracked).length });
  await page.close();
}

// Untrack from popup (row 7a): remove the emoji listing.
{
  const { page: pp, errors, state } = await checkPopup(ctx, extId);
  const before = state.count;
  await pp.evaluate(() => {
    const li = [...document.querySelectorAll("#tv-list li")].find((l) => /Flipper/.test(l.textContent));
    li?.querySelector(".tv-remove")?.click();
  });
  await pp.waitForTimeout(800);
  const stateAfter = await pp.evaluate(() => ({
    count: document.querySelectorAll("#tv-list li").length,
    titles: [...document.querySelectorAll("#tv-list a")].map((a) => a.textContent.slice(0, 40)),
  }));
  const tracked = await getTracked(sw);
  log("untrack-from-popup", { errors, before, after: stateAfter, stillInStorage: "338298867" in tracked, storageCount: Object.keys(tracked).length });
  await pp.close();
}

// Final popup state (row 6 verification with remaining items) + emoji escaping snapshot taken earlier.
{
  const { page: pp, errors, state } = await checkPopup(ctx, extId);
  log("final-popup", { errors, count: state.count, countLabel: state.countLabel, items: state.items });
  await pp.close();
}

const tracked = await getTracked(sw);
log("phase2-storage-final", { count: Object.keys(tracked).length, tracked });
await ctx.close();
