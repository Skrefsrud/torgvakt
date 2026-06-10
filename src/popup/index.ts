import { getSettings, getTracked, saveSettings, untrackListing } from "../shared/storage";
import { renderListingItem } from "./render";
import type { Settings } from "../shared/types";

async function refresh(): Promise<void> {
  const tracked = Object.values(await getTracked()).sort((a, b) => b.addedAt - a.addedAt);
  const list = document.getElementById("tv-list") as HTMLUListElement;
  const empty = document.getElementById("tv-empty") as HTMLParagraphElement;
  const count = document.getElementById("tv-count") as HTMLSpanElement;
  list.innerHTML = tracked.map(renderListingItem).join("");
  empty.hidden = tracked.length > 0;
  count.textContent = tracked.length ? `${tracked.length} fulgt` : "";
  for (const btn of list.querySelectorAll<HTMLButtonElement>(".tv-remove")) {
    btn.addEventListener("click", () => {
      void untrackListing(btn.dataset.id as string).then(refresh);
    });
  }
}

async function initSettings(): Promise<void> {
  const s = await getSettings();
  const interval = document.getElementById("tv-interval") as HTMLSelectElement;
  const drops = document.getElementById("tv-drops") as HTMLInputElement;
  const all = document.getElementById("tv-all") as HTMLInputElement;
  interval.value = String(s.checkIntervalHours);
  drops.checked = s.notifyDrops;
  all.checked = s.notifyAll;
  const save = () =>
    void saveSettings({
      checkIntervalHours: Number(interval.value) as Settings["checkIntervalHours"],
      notifyDrops: drops.checked,
      notifyAll: all.checked,
    });
  interval.addEventListener("change", save);
  drops.addEventListener("change", save);
  all.addEventListener("change", save);
}

void refresh();
void initSettings();
