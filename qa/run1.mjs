// Phase 1: Torget core flow + consent wall + free items + popup-after-every-follow.
import { launch, getTracked, probeButton, clickButton, visitListing, checkPopup } from "./helpers.mjs";
import fs from "node:fs";

const log = (tag, data) => {
  const line = JSON.stringify({ tag, ...data });
  console.log(line);
  fs.appendFileSync("/home/glinux/Projects/torgvakt/qa/results.jsonl", line + "\n");
};

const { ctx, sw, extId } = await launch();

const TORGET = [
  { name: "electronics", url: "https://www.finn.no/recommerce/forsale/item/409559330", expPrice: 1000 },
  { name: "furniture", url: "https://www.finn.no/recommerce/forsale/item/450203983", expPrice: 12000 },
  { name: "clothing", url: "https://www.finn.no/recommerce/forsale/item/294478020", expPrice: 275 },
  { name: "sports-aoa-longtitle", url: "https://www.finn.no/recommerce/forsale/item/196694855", expPrice: 100 },
];

let first = true;
for (const t of TORGET) {
  const consoleErrors = [];
  const page = await visitListing(ctx, t.url, { consoleErrors });
  if (first) {
    // Row 8: consent dialog present? button must inject anyway.
    const consent = await page.evaluate(() => {
      const f = [...document.querySelectorAll("iframe")].find((i) => /sp_message|sourcepoint|consent|privacy/i.test(i.src + i.id + i.title));
      const d = document.querySelector('[id*="sp_message"], [class*="message-container"], [aria-label*="amtykke" i], dialog[open]');
      return { iframe: f ? f.src.slice(0, 100) : null, dialog: d ? (d.id || d.className).slice(0, 80) : null, bodyHasConsentText: /informasjonskapsler|samtykke/i.test(document.body.innerText.slice(0, 8000)) };
    }).catch((e) => ({ err: String(e) }));
    log("consent-wall", { url: t.url, consent });
  }
  const btn = await probeButton(page);
  log("button", { listing: t.name, url: t.url, btn, consoleErrors });
  if (btn) {
    await clickButton(page);
    await page.waitForTimeout(1200);
    const tracked = await getTracked(sw);
    const id = t.url.match(/(\d+)/)[1];
    log("follow", { listing: t.name, id, labelAfter: (await probeButton(page, 2000))?.label, entry: tracked[id] ?? null, totalTracked: Object.keys(tracked).length, consoleErrors });
  }
  await page.close();
  // Popup after EVERY follow.
  const { page: pp, errors, state } = await checkPopup(ctx, extId);
  log("popup-after-follow", { listing: t.name, errors, count: state.count, countLabel: state.countLabel, items: state.items.map((i) => ({ title: i.title?.slice(0, 70), price: i.price, sparkline: i.sparkline?.slice(0, 40), hasRemove: i.hasRemove, broken: i.broken })) });
  await pp.close();
  first = false;
}

// Row 2: free items ("gis bort")
for (const url of ["https://www.finn.no/recommerce/forsale/item/459482468", "https://www.finn.no/recommerce/forsale/item/446070327"]) {
  const consoleErrors = [];
  const page = await visitListing(ctx, url, { consoleErrors });
  const btn = await probeButton(page, 8000);
  const pageInfo = await page.evaluate(() => ({
    title: document.title.slice(0, 80),
    hasGisBort: /gis bort/i.test(document.body.innerText),
    hasLdProduct: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => /"Product"/.test(s.textContent)),
    priceTexts: (document.body.innerText.match(/\d[\d\s]*kr/g) || []).slice(0, 5),
  })).catch((e) => ({ err: String(e) }));
  let followResult = null;
  if (btn) {
    await clickButton(page);
    await page.waitForTimeout(1000);
    const tracked = await getTracked(sw);
    const id = url.match(/(\d+)/)[1];
    followResult = tracked[id] ?? "clicked but no entry";
  }
  log("free-item", { url, btn, pageInfo, followResult, consoleErrors });
  await page.close();
}

// Extra: active "Til salgs" listing observed without Product JSON-LD via curl
{
  const consoleErrors = [];
  const url = "https://www.finn.no/recommerce/forsale/item/461484344";
  const page = await visitListing(ctx, url, { consoleErrors });
  const btn = await probeButton(page, 8000);
  const pageInfo = await page.evaluate(() => ({
    title: document.title.slice(0, 80),
    hasLdProduct: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => /"Product"/.test(s.textContent)),
    priceTexts: (document.body.innerText.match(/\d[\d\s]*kr/g) || []).slice(0, 5),
    bodySnippet: document.body.innerText.slice(0, 200),
  })).catch((e) => ({ err: String(e) }));
  log("no-ld-active-listing", { url, btn, pageInfo, consoleErrors });
  await page.close();
}

const tracked = await getTracked(sw);
log("phase1-storage-final", { count: Object.keys(tracked).length, tracked });
await ctx.close();
