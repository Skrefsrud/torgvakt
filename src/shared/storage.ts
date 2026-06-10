import type { Settings, TrackedListing } from "./types";

export const DEFAULT_SETTINGS: Settings = { checkIntervalHours: 6, notifyDrops: true, notifyAll: false };

export async function getTracked(): Promise<Record<string, TrackedListing>> {
  const r = await chrome.storage.local.get("tracked");
  const raw = (r.tracked as Record<string, TrackedListing> | undefined) ?? {};
  // Normalize legacy/corrupt entries so schema evolution can never strand them:
  // entries without history are unusable and dropped; missing fields get defaults.
  const out: Record<string, TrackedListing> = {};
  for (const [id, l] of Object.entries(raw)) {
    if (!Array.isArray(l.history) || l.history.length === 0) continue;
    out[id] = { ...l, status: l.status ?? "active", addedAt: l.addedAt ?? 0 };
  }
  return out;
}

export async function saveTracked(tracked: Record<string, TrackedListing>): Promise<void> {
  await chrome.storage.local.set({ tracked });
}

export async function trackListing(listing: TrackedListing): Promise<void> {
  const tracked = await getTracked();
  tracked[listing.id] = listing;
  await saveTracked(tracked);
}

export async function untrackListing(id: string): Promise<void> {
  const tracked = await getTracked();
  delete tracked[id];
  await saveTracked(tracked);
}

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...(r.settings as Partial<Settings> | undefined) };
  // A corrupt interval would feed chrome.alarms periodInMinutes:0 (dead alarm
  // or hammering); clamp to the known-good values.
  if (![1, 6, 24].includes(merged.checkIntervalHours)) merged.checkIntervalHours = 6;
  merged.notifyDrops = Boolean(merged.notifyDrops);
  merged.notifyAll = Boolean(merged.notifyAll);
  return merged;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}
