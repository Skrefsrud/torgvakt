import { getSettings, getTracked, saveSettings, trackListing, untrackListing } from "../src/shared/storage";
import type { TrackedListing } from "../src/shared/types";

const store: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (obj: Record<string, unknown>) => Object.assign(store, obj),
      },
    },
  };
});

const listing: TrackedListing = {
  id: "1", url: "https://www.finn.no/recommerce/forsale/item/1", title: "Sykkel",
  image: "", addedAt: 1, status: "active", history: [{ ts: 1, price: 500 }],
};

test("getTracked defaults to empty map", async () => {
  expect(await getTracked()).toEqual({});
});

test("track and untrack round-trip", async () => {
  await trackListing(listing);
  expect((await getTracked())["1"].title).toBe("Sykkel");
  await untrackListing("1");
  expect(await getTracked()).toEqual({});
});

test("settings default and merge", async () => {
  expect(await getSettings()).toEqual({ checkIntervalHours: 6, notifyDrops: true, notifyAll: false });
  await saveSettings({ checkIntervalHours: 1, notifyDrops: true, notifyAll: true });
  expect((await getSettings()).checkIntervalHours).toBe(1);
});

test("invalid persisted interval is clamped to a safe default", async () => {
  store.settings = { checkIntervalHours: 0, notifyDrops: true, notifyAll: false };
  expect((await getSettings()).checkIntervalHours).toBe(6);
  store.settings = { checkIntervalHours: "" };
  expect((await getSettings()).checkIntervalHours).toBe(6);
});

test("getTracked normalizes legacy/corrupt entries", async () => {
  store.tracked = {
    "1": { id: "1", url: "u", title: "ok", image: "", addedAt: 1, status: "active", history: [{ ts: 1, price: 5 }] },
    "2": { id: "2", url: "u", title: "no status/addedAt", image: "", history: [{ ts: 1, price: 5 }] },
    "3": { id: "3", url: "u", title: "no history", image: "", addedAt: 1, status: "active" },
  };
  const t = await getTracked();
  expect(Object.keys(t).sort()).toEqual(["1", "2"]); // historyless entry dropped
  expect(t["2"].status).toBe("active");
  expect(t["2"].addedAt).toBe(0);
});
