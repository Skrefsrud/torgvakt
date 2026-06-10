# Torgvakt pre-launch adversarial code review

Date: 2026-06-10. Scope: src/ (13 files), manifest.json, tests/ skimmed for existing coverage.
Known-fixed bugs (popup non-string image crash, check-cycle vs follow race via core/merge.ts) are not re-reported.
No code was modified.

Severity: P0 = ship-blocker, P1 = should-fix before launch, P2 = nice to have.

---

## P0

### P0-1. Relist matcher adopts the wrong listing for titles whose only distinguishing token is a short number
`src/core/relist.ts:17-21` (tokens length >= 3 filter), `src/core/relist.ts:50-64` (findRelistMatch)

`tokens()` drops every token shorter than 3 chars, including model numbers. Verified by execution:
- "iPhone 13" vs "iPhone 14" -> similarity 1.0 (both reduce to `{iphone}`); the `shared < 2 && sim < 1` guard does not fire because sim is exactly 1.
- Worse: "iPhone 13 128GB" vs "iPhone 14 128GB" -> similarity 1.0 AND 2 shared tokens (`{iphone, 128gb}`), so it passes the strict gate too.

User story: user tracks "iPhone 13 128GB" at 4500 kr. Seller marks it sold. Within 7 days someone else posts "iPhone 14 128GB" at 5500 kr (inside the 0.4-1.4 price band). Next check cycle silently rebinds the entry to a different phone, appends its price to the history, notifies "Lagt ut på nytt", and the original listing's history is permanently corrupted - exactly the failure the file's own comment says must never happen. Phones, consoles, bike sizes ("str 54"), year models are the most-tracked categories on Torget, so this is the common case, not the edge.

Same mechanism hits single-generic-token titles: "Sofa" matches any other "Sofa" at a similar price (the Garmin test at tests/relist.test.ts:46 encodes this as intended behavior; for one-token titles it is a false-positive generator).

Fix direction: keep digit/short alphanumeric tokens (length >= 2 with a digit) in the token set, and refuse to rebind when the lost title has fewer than 2 informative tokens unless additional evidence matches (image URL hash, identical full title string).

---

## P1

### P1-1. Alarm dies permanently after extension disable/enable (and any alarm eviction); no existence guard
`src/background/index.ts:22-26`

The alarm is only (re)created on `onInstalled`, `onStartup`, and settings change. Chrome clears an extension's alarms when the user disables it; re-enabling fires neither `onInstalled` nor `onStartup`. Until the next full browser restart (which can be weeks on a machine that sleeps instead of shutting down), no checks run, no notifications fire, and nothing in the UI reveals it.

Also fragile: `scheduleAlarm` awaits `clear` then calls `create` - if the create fails (see P2-3 interval corruption) the old alarm is already gone.

Fix direction: at the top level of the service worker (runs on every SW wake), `chrome.alarms.get(ALARM)` and create it if missing; create before clear (or use the same-name overwrite semantics of `create` and drop `clear` entirely).

### P1-2. Check cycle buffers all results in memory and saves only at the very end; notifications fire before persistence
`src/background/index.ts:37-67`

With N tracked listings the cycle runs ~N x (fetch + 2.5 s). The SW likely survives (each fetch resets the 30 s idle timer), but death mid-cycle is realistic: browser shutdown, OS sleep, crash, Chrome update. When that happens:
- every price point and status change gathered so far is lost (`ops` is in-memory only),
- notifications already shown are re-shown next cycle (price change re-detected against old history) - duplicate "Pris ned" spam,
- a relist rebind that was notified never gets saved; clicking that notification looks up `match.id` in storage, finds nothing, and silently does nothing (`background/index.ts:126-131`). This dead-click window exists even without SW death, because the relist notification fires minutes before the cycle-end save.

User story: 60 tracked listings = ~3.5 min cycle. User closes laptop lid at minute 2. Three price drops were detected and notified; none persisted. Six hours later: the same three notifications again.

Fix direction: merge-and-save incrementally (per listing or per small batch, reusing `applyCycleOps` with a fresh read each time) and emit notifications only after the corresponding state is persisted.

### P1-3. `offers` as an array is not handled; valid schema.org shape yields price null
`src/core/parse.ts:12` (LdProduct type), `src/core/parse.ts:69-71`; same pattern in `src/core/searchParse.ts:18`

`offers?: { price }` assumes a single object. `offers: [{...}]` is equally valid schema.org and common when sites emit multiple offers (e.g. with/without shipping). If finn ships this shape on any vertical or after a frontend update, the cascade is: content script renders no follow button at all (`content/index.ts:20` returns early on price null), and for already-tracked listings the background falls into the disposed scan (P1-4) or records nothing forever. All fixtures use single-object offers, so tests would stay green through such a regression.

Fix direction: normalize offers to its first element when it is an array, in both parsers.

### P1-4. Disposed marker scanned across the entire HTML, gated only by price-parse failure - false "sold/removed" on live listings
`src/core/parse.ts:48-55`, `src/core/check.ts:23-33`

`DISPOSED_RE` matches `"disposed":true` anywhere in the page. The live-listing fixture already contains `disposed\":false` in hydration state, proving the key ships on active pages. The scan only runs when the Product parse fails or price is null - but that is exactly when it is most dangerous:
- active listing with an unparseable price (decimal comma P2-1, offers array P1-3, "Pris på forespørsel") plus a recommendation/feed hydration blob containing some *other* listing's `"disposed":true`,
- or a deleted listing that 302-redirects to a browse/search page (fetch follows redirects, final status 200, no Product JSON-LD) whose embedded result data includes a disposed entry.

Result: listing falsely flipped to sold/removed, checks stop, and after the 7-day relist window it is dead in the UI forever even though it is live - or worse, the relist matcher then "finds" it again and rebinds (interacting with P0-1).

Fix direction: scope the disposed scan to the hydration object that contains the tracked listing's own id (require the id within some byte proximity, or parse the specific hydration script tag), and treat redirect-to-different-URL as "removed" signal instead of parsing the landing page.

### P1-5. Read-modify-write races on the single `tracked` storage key
`src/shared/storage.ts:14-25`

`trackListing`/`untrackListing` are get -> mutate -> set with no serialization. Two listing tabs where the user clicks "Følg pris" in quick succession (classic middle-click-five-listings-then-go-through-them flow): both read the same snapshot, both write, last write wins, the first follow vanishes with no feedback - its button still says "Følges ✓". Same race between popup untrack and a tab follow. The merge.ts fix covered only the check-cycle writer; user-initiated writers still race each other.

Fix direction: route all tracked-map writes through the background service worker via `chrome.runtime.sendMessage` (single writer), or store each listing under its own `tracked:<id>` key so writes don't overlap.

---

## P2

### P2-1. Decimal-comma prices parse to null
`src/core/parse.ts:39-43`, `src/core/searchParse.ts:22-26`

`Number("1.234,56")` is NaN (verified), so any nb-NO-formatted price string yields null -> no follow button, no history point, and entry into the P1-4 disposed-scan path. Today finn emits integer prices in JSON-LD, so this is latent, but a single formatting change on finn's side disables the product. Fix direction: strip thousands separators (space, nbsp, period-before-3-digits) and convert decimal comma before `Number()`.

### P2-2. Listings without a parsable price cannot be followed or unfollowed on-page
`src/content/index.ts:19-20`

`if (!parsed || parsed.price === null) return;` - no button, no inline history. "Gis bort" (price 0) works, but price-on-request listings get nothing, and a *tracked* listing whose page goes price-less (sold/disposed) loses its on-page untrack affordance. Fix direction: still render the button (and history panel for tracked entries) in a price-less state; only block the initial follow.

### P2-3. Corrupted/legacy `checkIntervalHours` becomes 0 via the popup, then kills or floors the alarm
`src/popup/index.ts:25-33`, `src/background/index.ts:14-20`, `src/shared/storage.ts:27-30`

If stored `checkIntervalHours` is anything but 1/6/24 (older release, corruption), `interval.value = String(s)` sets the select to "", and the next settings save writes `Number("") === 0` (verified). `scheduleAlarm` then clears the good alarm and creates one with `periodInMinutes: 0` - Chrome either rejects it (alarm permanently dead, see P1-1) or clamps to the 30 s minimum (hammering finn 120x/hour, likely IP rate-limit/ban). Fix direction: validate in `getSettings` (fall back to 6 when value is not one of the allowed literals) and clamp in `scheduleAlarm`.

### P2-4. `lastCheckAt` is updated even when every fetch failed; no backoff or failure surfacing
`src/background/index.ts:66`

If finn 429s/blocks the extension's traffic, every listing silently stays stale, yet `lastCheckAt` says the check ran fine. The user discovers weeks later that prices never updated. Fix direction: count per-cycle failures, store a `lastCheckOk`/error counter, surface staleness in the popup, and back off the alarm cadence on consecutive failures.

### P2-5. Stale notification clicks after a relist rebind do nothing
`src/background/index.ts:120-133`

A "Pris ned" notification carries id `torgvakt-<oldId>`. If the listing is later rebound (or the notification is clicked days later after a rebind), `getTracked()[oldId]` is gone; the click silently clears the notification without opening anything. Fix direction: in the click handler, also search entries whose `relistedFrom` includes the id.

### P2-6. Price-element heuristic can anchor the button to an unrelated price
`src/content/dom.ts:14-20`

`findPriceElement` returns the first leaf element document-order matching `^\d[\d\s]*kr$` across all shadow roots. Monthly financing ("kr/mnd") and labeled totals ("Totalpris: ...") are excluded, but bare prices in recommendation carousels, gallery cards, or shipping widgets ("99 kr" as a standalone leaf) match. If finn's DOM ever orders one of those before the main price, the follow button renders inside a random card - user follows listing A from inside listing B's recommendation tile. Fix direction: restrict the search to the subtree containing the h1/main content, or pick the matching element with the largest computed font size.

### P2-7. Quota exhaustion on the single `tracked` key fails unhandled
`src/shared/storage.ts:11`, `src/background/index.ts:65`

500 points x hundreds of listings approaches chrome.storage.local's 10 MB ceiling; a rejected `set()` at cycle end throws outside any try/catch (the loop's catch does not cover the final save), losing the whole cycle every time, forever, with no signal. Fix direction: catch and surface storage errors, prune history more aggressively under pressure, and consider `unlimitedStorage` if heavy use is expected.

### P2-8. Two duplicate dead listings can rebind to the same relist candidate in one cycle
`src/background/index.ts:95` (candidate filter), `src/core/merge.ts:22-27`

The candidate filter only excludes ids in the cycle-start snapshot, not ids already claimed by an earlier rebind in the same cycle. Two tracked copies of the same item (user followed the original and a previous relist as separate entries) both match the new posting; `applyCycleOps` lets the second rebind overwrite the first - one history chain silently lost, two notifications shown. Fix direction: track claimed candidate ids within the cycle and skip them.

### P2-9. Relist notification fires for price increases when only "Varsle ved prisfall" is on
`src/background/index.ts:108-113`

Gate is `notifyDrops || notifyAll`, message includes the price change even when it went up. Defensible product-wise (relist itself is the event), but inconsistent with the price-change gating in check.ts. Fix direction: decide intentionally; if relist is always notable, say so in the settings label.

### P2-10. "siden du begynte å følge" becomes wrong after history trimming
`src/core/history.ts:13` (slice(-500)), `src/content/inline.ts:27`, `src/popup/render.ts:33`

After 500 price changes the first point is dropped and `priceChange` baselines on the oldest retained point while the label still claims "since you started following". Fix direction: pin the first point (or store `initialPrice`) and trim from the middle.

---

## P3 / notes

- **esc() does not neutralize `javascript:` hrefs** (`src/popup/render.ts:38`): `l.url` is only ever built from finn locations or constructed ids, and extension-page CSP blocks javascript: navigation, so exploitation requires already-compromised storage. Cheap hardening: only render the link when the url starts with `https://www.finn.no/`.
- **Schema evolution defaults** (`src/popup/index.ts:6`, `src/popup/render.ts:42`): entries missing `addedAt` sort NaN-randomly; missing `status` renders greyed-out and is silently never checked again (`background/index.ts:42` matches neither checkable nor dead). Fix: normalize defaults in `getTracked`.
- **No idempotency guard in content script** (`src/content/index.ts:31-40`): `renderButton` never checks for an existing `#torgvakt-btn`. Today main() runs once per load; any future double-run (extension reload re-injection, finn SPA hook) duplicates buttons. Related: `toggle()` builds `url` from live `location` but id/title/price from the injection-time parse - if finn ever client-side navigates between listings, the saved entry mixes the old id with the new URL. Cheap insurance: re-derive the id from `location` at click time and bail on mismatch; remove any existing button before inserting.
- **bfcache restore**: scripts do not re-run, so no double injection, but the button label can be stale (untracked via popup while the tab sat in bfcache). A `pageshow` listener with `event.persisted` could re-sync.
- **Mobility relist unsupported** is documented in code; just make sure store listing copy doesn't promise relist detection for cars.
- **manifest.json / store review**: clean. Minimal permissions (storage, alarms, notifications), single-site host permission required for background re-fetch and relist search, no remote code, no broad patterns. `chrome.tabs.create` needs no "tabs" permission. One reviewer-facing note: justify `https://www.finn.no/*` (background fetch + search) in the privacy/permission justification fields, since content scripts alone would only need the two item paths.
- **Negative-number formatting** is handled correctly: render paths use `Math.abs` + manual sign, so the nb-NO U+2212 minus never reaches the UI. `formatPrice` already strips U+00A0/U+202F. No bug.

## Verified-good (checked, no finding)

- 6h interval math (`checkIntervalHours * 60` minutes) is correct.
- `applyFetchResult` disposed branch returns in both notify/no-notify cases; no fall-through to `status = "active"`.
- merge.ts correctly skips rebinds whose source was untracked and never resurrects removed entries (tests cover this).
- `buildSearchQuery` returning "" for all-stopword titles correctly aborts the relist attempt.
- Notification ids: same-listing notifications replace each other by design; the relist notification correctly uses the new id.
- popup sort is stable in modern V8; `renderListingList` per-row try/catch correctly isolates corrupt entries.
