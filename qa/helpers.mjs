import { chromium } from "@playwright/test";

const dist = "/home/glinux/Projects/torgvakt/dist";

export async function launch() {
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  const [w] = ctx.serviceWorkers().length
    ? ctx.serviceWorkers()
    : [await ctx.waitForEvent("serviceworker")];
  const extId = new URL(w.url()).host;
  return { ctx, sw: w, extId };
}

export async function getTracked(sw) {
  return sw.evaluate(async () => (await chrome.storage.local.get("tracked")).tracked ?? {});
}

// Find the torgvakt button across shadow roots; returns info, not handle.
export const BTN_PROBE = `(() => {
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.id === "torgvakt-btn") return el;
      if (el.shadowRoot) { const hit = walk(el.shadowRoot); if (hit) return hit; }
    }
    return null;
  };
  const btn = walk(document);
  if (!btn) return null;
  const prev = btn.previousElementSibling;
  const hist = walk2(document);
  function walk2(root) {
    for (const el of root.querySelectorAll("*")) {
      if (el.id === "torgvakt-history") return el;
      if (el.shadowRoot) { const hit = walk2(el.shadowRoot); if (hit) return hit; }
    }
    return null;
  }
  return {
    label: btn.textContent,
    floating: btn.style.position === "fixed",
    anchorText: prev ? (prev.textContent || "").trim().slice(0, 120) : null,
    anchorTag: prev ? prev.tagName : null,
    parentTag: btn.parentElement ? btn.parentElement.tagName : null,
    historyText: hist ? (hist.textContent || "").trim().slice(0, 200) : null,
  };
})()`;

export const BTN_CLICK = `(() => {
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.id === "torgvakt-btn") return el;
      if (el.shadowRoot) { const hit = walk(el.shadowRoot); if (hit) return hit; }
    }
    return null;
  };
  const btn = walk(document);
  if (!btn) return false;
  btn.click();
  return true;
})()`;

export async function probeButton(page, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await page.evaluate(BTN_PROBE).catch(() => null);
    if (info) return info;
    await page.waitForTimeout(500);
  }
  return null;
}

export async function clickButton(page) {
  return page.evaluate(BTN_CLICK);
}

export async function visitListing(ctx, url, { consoleErrors = [] } = {}) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`);
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => {
    consoleErrors.push(`goto failed: ${e.message}`);
  });
  await page.waitForTimeout(3000); // let hydration + content script settle
  return page;
}

// Open the popup, capture pageerrors, extract rendered items.
export async function checkPopup(ctx, extId) {
  const errors = [];
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message} :: ${e.stack?.split("\n")[1] ?? ""}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => {
    const items = [...document.querySelectorAll("#tv-list li")].map((li) => ({
      title: li.querySelector("a")?.textContent ?? li.querySelector(".tv-mid")?.textContent ?? null,
      href: li.querySelector("a")?.getAttribute("href") ?? null,
      price: li.querySelector("strong")?.textContent ?? null,
      change: li.querySelector(".tv-change")?.textContent ?? null,
      badge: li.querySelector(".tv-badge")?.textContent ?? null,
      sparkline: li.querySelector("svg path")?.getAttribute("d") ?? null,
      hasRemove: !!li.querySelector(".tv-remove"),
      hasImg: !!li.querySelector("img"),
      imgSrc: li.querySelector("img")?.getAttribute("src")?.slice(0, 60) ?? null,
      broken: li.classList.contains("tv-broken"),
      rawHtmlSnippet: li.innerHTML.length > 4000 ? li.innerHTML.slice(0, 400) : undefined,
    }));
    return {
      count: items.length,
      countLabel: document.getElementById("tv-count")?.textContent ?? null,
      emptyHidden: document.getElementById("tv-empty")?.hidden ?? null,
      items,
    };
  });
  return { page, errors, state };
}
