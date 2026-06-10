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
  // create() with the same name replaces the existing alarm; no clear() needed
  // (clear-then-create could leave NO alarm if create fails).
  chrome.alarms.create(ALARM, {
    periodInMinutes: settings.checkIntervalHours * 60,
    delayInMinutes: 1,
  });
}

// Self-healing: Chrome drops alarms on extension disable/enable, which fires
// neither onInstalled nor onStartup. Re-arm on every service worker wake.
void chrome.alarms.get(ALARM).then((a) => {
  if (!a) void scheduleAlarm();
});

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

/** Merge one cycle step into a FRESH storage read (user may act mid-cycle). */
async function persistOps(ops: CycleOps): Promise<void> {
  const fresh = await getTracked();
  await saveTracked(applyCycleOps(fresh, ops));
}

async function runCheck(): Promise<void> {
  const snapshot = await getTracked();
  const settings = await getSettings();
  // ids claimed by a rebind this cycle: two dead duplicates must not adopt
  // the same candidate
  const claimed = new Set<string>(Object.keys(snapshot));
  for (const listing of Object.values(snapshot)) {
    const checkable = listing.status === "active" || listing.status === "parseError";
    const relistWindowOpen =
      listing.removedAt !== undefined && Date.now() - listing.removedAt < RELIST_WINDOW_MS;
    if (!checkable && !(isDead(listing) && relistWindowOpen)) continue;
    try {
      let msg: string | null = null;
      if (checkable) {
        const res = await fetch(listing.url, { credentials: "omit" });
        const html = res.ok ? await res.text() : null;
        msg = applyFetchResult(listing, res.status, html, settings, Date.now());
        if (isDead(listing) && listing.removedAt === undefined) listing.removedAt = Date.now();
      }
      const rebind = isDead(listing) ? await attemptRelist(listing, claimed, settings) : null;
      // Persist each step immediately: a dying service worker must not lose
      // the whole cycle, and notifications must never precede their data.
      if (rebind) {
        claimed.add(rebind.op.listing.id);
        await persistOps({ updates: [], rebinds: [rebind.op] });
        if (rebind.message) notify(rebind.op.listing.id, rebind.op.listing.title, rebind.message);
      } else {
        await persistOps({ updates: [listing], rebinds: [] });
        if (msg) notify(listing.id, listing.title, msg);
      }
    } catch {
      // network/storage error: retry next cycle
    }
    await sleep(BETWEEN_FETCHES_MS);
  }
  try {
    await chrome.storage.local.set({ lastCheckAt: Date.now() });
  } catch {
    // non-essential heartbeat
  }
}

interface RelistResult {
  op: CycleOps["rebinds"][number];
  message: string | null;
}

/**
 * The differentiator: finn sellers delete-and-repost to bump visibility, which
 * breaks FINN's own favorites. Search for a confident match and rebind the
 * entry so price history survives the relist.
 */
async function attemptRelist(
  listing: TrackedListing,
  claimed: Set<string>,
  settings: Settings,
): Promise<RelistResult | null> {
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
  const candidates = parseSearchHtml(await res.text()).filter((c) => !claimed.has(c.id));
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

  // Notification policy: a price increase only notifies under notifyAll;
  // drops and same-price relists ride the default drops setting.
  const increased = match.price > lastPrice;
  let message: string | null = null;
  if ((increased && settings.notifyAll) || (!increased && (settings.notifyDrops || settings.notifyAll))) {
    message =
      match.price !== lastPrice
        ? `Lagt ut på nytt: ${formatPrice(lastPrice)} → ${formatPrice(match.price)}`
        : "Annonsen er lagt ut på nytt";
  }
  return { op: { oldId: listing.id, listing: rebound }, message };
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
    const tracked = await getTracked();
    // direct hit, or the entry was rebound after the notification was shown
    const listing =
      tracked[id] ?? Object.values(tracked).find((l) => l.relistedFrom?.includes(id));
    if (listing) void chrome.tabs.create({ url: listing.url });
    chrome.notifications.clear(notificationId);
  })();
});
