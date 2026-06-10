import { applyFetchResult } from "../core/check";
import { applyCycleOps, type CycleOps } from "../core/merge";
import { appendIfChanged, formatPrice } from "../core/history";
import { buildSearchQuery, findRelistMatch } from "../core/relist";
import { parseSearchHtml } from "../core/searchParse";
import { getSettings, getTracked, saveTracked } from "../shared/storage";
import type { Settings, TrackedListing } from "../shared/types";

const ALARM = "torgvakt-check";
const BETWEEN_FETCHES_MS = 2500;
const RELIST_WINDOW_MS = 7 * 24 * 3600 * 1000;

async function scheduleAlarm(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM);
  chrome.alarms.create(ALARM, {
    periodInMinutes: settings.checkIntervalHours * 60,
    delayInMinutes: 1,
  });
}

chrome.runtime.onInstalled.addListener(() => void scheduleAlarm());
chrome.runtime.onStartup.addListener(() => void scheduleAlarm());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) void scheduleAlarm();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void runCheck();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isDead(l: TrackedListing): boolean {
  return l.status === "sold" || l.status === "removed";
}

async function runCheck(): Promise<void> {
  const snapshot = await getTracked();
  const settings = await getSettings();
  const ops: CycleOps = { updates: [], rebinds: [] };
  for (const listing of Object.values(snapshot)) {
    const checkable = listing.status === "active" || listing.status === "parseError";
    const relistWindowOpen =
      listing.removedAt !== undefined && Date.now() - listing.removedAt < RELIST_WINDOW_MS;
    if (!checkable && !(isDead(listing) && relistWindowOpen)) continue;
    try {
      if (checkable) {
        const res = await fetch(listing.url, { credentials: "omit" });
        const html = res.ok ? await res.text() : null;
        const msg = applyFetchResult(listing, res.status, html, settings, Date.now());
        if (msg) notify(listing.id, listing.title, msg);
        if (isDead(listing) && listing.removedAt === undefined) listing.removedAt = Date.now();
      }
      const rebind = isDead(listing) ? await attemptRelist(listing, snapshot, settings) : null;
      if (rebind) ops.rebinds.push(rebind);
      else ops.updates.push(listing);
    } catch {
      // network error: retry next cycle
    }
    await sleep(BETWEEN_FETCHES_MS);
  }
  // Merge into a fresh read: the user may have tracked/untracked listings
  // while this cycle was sleeping between fetches.
  const fresh = await getTracked();
  await saveTracked(applyCycleOps(fresh, ops));
  await chrome.storage.local.set({ lastCheckAt: Date.now() });
}

/**
 * The differentiator: finn sellers delete-and-repost to bump visibility, which
 * breaks FINN's own favorites. Search for a confident match and rebind the
 * entry so price history survives the relist.
 */
async function attemptRelist(
  listing: TrackedListing,
  snapshot: Record<string, TrackedListing>,
  settings: Settings,
): Promise<CycleOps["rebinds"][number] | null> {
  // Relist search is Torget-only for now: mobility search URLs are per-subvertical
  // (mc, car, boat, ...) and the listing URL does not reveal which one.
  if (!listing.url.includes("/recommerce/forsale/")) return null;
  if (listing.removedAt === undefined || Date.now() - listing.removedAt >= RELIST_WINDOW_MS) return null;
  const lastPrice = listing.history[listing.history.length - 1]?.price;
  if (lastPrice === undefined) return null;
  const query = buildSearchQuery(listing.title);
  if (!query) return null;

  const res = await fetch(
    `https://www.finn.no/recommerce/forsale/search?q=${encodeURIComponent(query)}&sort=PUBLISHED_DESC`,
    { credentials: "omit" },
  );
  if (!res.ok) return null;
  const candidates = parseSearchHtml(await res.text()).filter((c) => !(c.id in snapshot));
  const match = findRelistMatch({ id: listing.id, title: listing.title, lastPrice }, candidates);
  if (!match) return null;

  const rebound: TrackedListing = {
    ...listing,
    id: match.id,
    url: `https://www.finn.no/recommerce/forsale/item/${match.id}`,
    title: match.title,
    image: match.image || listing.image,
    status: "active",
    history: appendIfChanged(listing.history, match.price, Date.now()).history,
    relistedFrom: [...(listing.relistedFrom ?? []), listing.id],
  };
  delete rebound.removedAt;

  if (settings.notifyDrops || settings.notifyAll) {
    const msg =
      match.price !== lastPrice
        ? `Lagt ut på nytt: ${formatPrice(lastPrice)} → ${formatPrice(match.price)}`
        : "Annonsen er lagt ut på nytt";
    notify(match.id, rebound.title, msg);
  }
  return { oldId: listing.id, listing: rebound };
}

function notify(id: string, title: string, message: string): void {
  chrome.notifications.create(`torgvakt-${id}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `Torgvakt: ${title}`,
    message,
  });
}

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    const id = notificationId.replace("torgvakt-", "");
    const listing = (await getTracked())[id];
    if (listing) void chrome.tabs.create({ url: listing.url });
    chrome.notifications.clear(notificationId);
  })();
});
