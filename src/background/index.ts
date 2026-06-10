import { applyFetchResult } from "../core/check";
import { getSettings, getTracked, saveTracked } from "../shared/storage";

const ALARM = "torgvakt-check";
const BETWEEN_FETCHES_MS = 2500;

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

async function runCheck(): Promise<void> {
  const tracked = await getTracked();
  const settings = await getSettings();
  const active = Object.values(tracked).filter((l) => l.status === "active" || l.status === "parseError");
  for (const listing of active) {
    try {
      const res = await fetch(listing.url, { credentials: "omit" });
      const html = res.ok ? await res.text() : null;
      const msg = applyFetchResult(listing, res.status, html, settings, Date.now());
      if (msg) notify(listing.id, listing.title, msg);
    } catch {
      // network error: retry next cycle
    }
    await sleep(BETWEEN_FETCHES_MS);
  }
  await saveTracked(tracked);
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
