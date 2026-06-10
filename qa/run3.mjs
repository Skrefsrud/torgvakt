// Phase 3: sold listings behavior + untrack from page and popup + final popup.
import { launch, getTracked, probeButton, clickButton, visitListing, checkPopup } from "./helpers.mjs";
import fs from "node:fs";

const log = (tag, data) => {
  const line = JSON.stringify({ tag, ...data });
  console.log(line);
  fs.appendFileSync("/home/glinux/Projects/torgvakt/qa/results.jsonl", line + "\n");
};

const { ctx, sw, extId } = await launch();

const SOLD_BADGE = `(() => {
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.children.length === 0 && el.textContent && el.textContent.trim() === "Solgt") return { tag: el.tagName, cls: String(el.className).slice(0, 60) };
      if (el.shadowRoot) { const hit = walk(el.shadowRoot); if (hit) return hit; }
    }
    return null;
  };
  return walk(document);
})`;

// 3a: sold listing WITH Product JSON-LD still InStock
{
  const consoleErrors = [];
  const url = "https://www.finn.no/recommerce/forsale/item/466129966";
  const page = await visitListing(ctx, url, { consoleErrors });
  const soldBadge = await page.evaluate(`(${SOLD_BADGE})()`).catch((e) => String(e));
  const btn = await probeButton(page, 8000);
  let entry = null;
  if (btn) {
    await clickButton(page);
    await page.waitForTimeout(1200);
    entry = (await getTracked(sw))["466129966"] ?? null;
  }
  log("sold-with-ld", { url, soldBadge, btn, entry, consoleErrors: consoleErrors.slice(0, 3) });
  await page.close();
}

// 3b: sold listing WITHOUT Product JSON-LD
{
  const consoleErrors = [];
  const url = "https://www.finn.no/recommerce/forsale/item/465266905";
  const page = await visitListing(ctx, url, { consoleErrors });
  const soldBadge = await page.evaluate(`(${SOLD_BADGE})()`).catch((e) => String(e));
  const btn = await probeButton(page, 8000);
  log("sold-no-ld", { url, soldBadge, btn, consoleErrors: consoleErrors.slice(0, 3) });
  await page.close();
}

// 3c: track two more for untrack flows
for (const url of ["https://www.finn.no/recommerce/forsale/item/409559330", "https://www.finn.no/recommerce/forsale/item/338298867"]) {
  const page = await visitListing(ctx, url, {});
  const btn = await probeButton(page);
  if (btn) { await clickButton(page); await page.waitForTimeout(1000); }
  await page.close();
}
log("storage-before-untracks", { tracked: Object.keys(await getTracked(sw)) });

// popup escaping check on the emoji/sold rows: dump raw innerHTML of list
{
  const { page: pp, errors, state } = await checkPopup(ctx, extId);
  const rawRows = await pp.evaluate(() =>
    [...document.querySelectorAll("#tv-list li")].map((li) => ({
      a: li.querySelector("a")?.outerHTML.slice(0, 300),
      badge: li.querySelector(".tv-badge")?.outerHTML ?? null,
    })),
  );
  log("popup-raw-rows", { errors, count: state.count, countLabel: state.countLabel, rawRows });
  await pp.close();
}

// 3d: untrack from the listing page button
{
  const page = await visitListing(ctx, "https://www.finn.no/recommerce/forsale/item/409559330", {});
  const btn = await probeButton(page);
  const labelBefore = btn?.label;
  const inlineHistoryBefore = btn?.historyText;
  await clickButton(page);
  await page.waitForTimeout(1000);
  const after = await probeButton(page, 3000);
  const tracked = await getTracked(sw);
  log("untrack-from-page", { labelBefore, inlineHistoryBefore, labelAfter: after?.label, historyAfter: after?.historyText, stillInStorage: "409559330" in tracked, remaining: Object.keys(tracked) });
  await page.close();
}

// 3e: untrack from popup
{
  const { page: pp, errors } = await checkPopup(ctx, extId);
  const clicked = await pp.evaluate(() => {
    const li = [...document.querySelectorAll("#tv-list li")].find((l) => /Flipper/.test(l.textContent));
    if (!li) return false;
    li.querySelector(".tv-remove").click();
    return true;
  });
  await pp.waitForTimeout(900);
  const stateAfter = await pp.evaluate(() => ({
    count: document.querySelectorAll("#tv-list li").length,
    countLabel: document.getElementById("tv-count")?.textContent,
    emptyHidden: document.getElementById("tv-empty")?.hidden,
  }));
  const tracked = await getTracked(sw);
  log("untrack-from-popup", { clicked, errors, stateAfter, stillInStorage: "338298867" in tracked, remaining: Object.keys(tracked) });
  await pp.close();
}

// 3f: final popup
{
  const { page: pp, errors, state } = await checkPopup(ctx, extId);
  log("final-popup", { errors, count: state.count, countLabel: state.countLabel, items: state.items });
  await pp.close();
}

log("phase3-storage-final", { tracked: await getTracked(sw) });
await ctx.close();
