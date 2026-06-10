import type { Settings, TrackedListing } from "./types";

export const DEFAULT_SETTINGS: Settings = { checkIntervalHours: 6, notifyDrops: true, notifyAll: false };

export async function getTracked(): Promise<Record<string, TrackedListing>> {
  const r = await chrome.storage.local.get("tracked");
  return (r.tracked as Record<string, TrackedListing> | undefined) ?? {};
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
  return { ...DEFAULT_SETTINGS, ...(r.settings as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}
