# Torgvakt - Exploratory QA Report (live finn.no)

Date: 2026-06-10
Build under test: `dist/` (manifest 0.1.0), driven black-box via Playwright chromium with the unpacked extension.
Raw evidence: `qa/results.jsonl` (every probe/follow/popup state logged as JSON). Test drivers: `qa/run1.mjs`, `qa/run2.mjs`, `qa/run3.mjs`, helpers in `qa/helpers.mjs`, static recon in `qa/probe.mjs`.

15 live listings exercised across Torget and Mobility. Popup opened and inspected after every single follow (16 popup opens total): zero popup pageerrors in all of them.

## Results table

| # | Matrix row | Verdict | Notes |
|---|-----------|---------|-------|
| 1 | Torget: electronics, furniture, clothing, sports (4 listings) | PASS | Button anchored next to price on all 4; correct storage shape; popup clean after each follow |
| 2 | Torget free items ("gis bort", price 0) | DEGRADED (defect D4) | No button injected at all - silent no-op. No crash, no console error from extension |
| 3 | Sold listing, page still up | FAIL (defects D2, D3) | Sold listing with JSON-LD: tracked as `status:"active"` with no sold indication. Sold listing without JSON-LD: no button, silent |
| 4 | Mobility: MC, private car, boat, dealer car | PASS (minor D5) | All 5 tracked correctly. Dealer ads: button anchored to cash price ("56 942 kr", "486 942 kr"), NOT the monthly "fra 859 kr/mnd" price |
| 5 | Long title + special characters (aoa, emojis, quotes) | PARTIAL (defect D6) | 65-char title with aoa renders intact and escaped. Emoji title rendered as literal `\u{d83d}\u{dd25}` junk (source: finn JSON-LD; og:title has the real emoji) |
| 6 | 6+ tracked, popup correct | PASS | 8 tracked simultaneously; popup count "8 fulgt", all rows present with title, "N kr" price, sparkline path, remove button; zero pageerrors |
| 7 | Untrack from popup and from page button | PASS | Page button: "Folges" -> click -> "Folg pris", storage entry removed, inline history widget removed. Popup remove: row gone, count updated, storage updated |
| 8 | First-visit consent wall | PASS | Fresh profile, Schibsted/Sourcepoint dialog present (`sp_message_container_1451989`, cmpv2.finn.no iframe) and untouched; button still injected anchored to "1 000 kr" |

Injection mode: every successful injection in all 15 page visits was ANCHORED (inline next to the price element). The floating bottom-right fallback was never observed. Note: the fallback is unreachable for the failure pages found, because the content script exits before rendering any button when price parsing fails (see D1/D4).

## Defects

### D1 (P2) - Active, priced listings with no Product JSON-LD get no button at all
- Listing: https://www.finn.no/recommerce/forsale/item/461484344 ("Togbillett Stavanger - Oslo S 29.4", marked "Til salgs", price 300 kr visible on page and present in finn's hydration payload as `"priceText":"300 kr"` / `"price":300`)
- Expected: "Folg pris" button near the price, or at minimum the floating fallback.
- Actual: no button injected anywhere (verified in-browser with shadow-piercing search after 8s wait). The page serves only the Organization JSON-LD - no Product node - so `parseListingHtml` returns price null and the content script exits silently.
- Scale: in a random sample of 70 recent Torget listing IDs plus ~150 search-result listings probed statically, a meaningful fraction of perfectly normal "Til salgs" pages (e.g. 466419513, 423235912) were served without Product JSON-LD. This is not an exotic edge case; tracking is silently unavailable on these.
- Console: no extension errors. (The page itself throws finn's own `Cannot read properties of undefined (reading 'pageStateTracker')` pageerror on these reduced pages - confirmed NOT extension code, `grep pageStateTracker dist/*` = 0 hits.)
- Storage: unchanged.

### D2 (P2) - Sold listing tracked as "active"; sold state invisible everywhere
- Listing: https://www.finn.no/recommerce/forsale/item/466129966 ("Titleist Vokey Wedge Sett 52 56 60 - Spin Milled")
- Page state: visible "Solgt" badge (`DIV.badge--warning font-bold mb-16`), and the hydration payload contains `"disposed":true`. But the Product JSON-LD still says `availability: https://schema.org/InStock`, price 2000.
- Expected: follow should be blocked, or the entry stored/displayed as sold.
- Actual: normal "Folg pris" button injects next to "2 000 kr"; clicking tracks it. Storage dump:
```json
{"id":"466129966","status":"active","title":"Titleist Vokey Wedge Sett 52° 56° 60° – Spin Milled",
 "history":[{"price":2000,"ts":1781104501751}], "url":"https://www.finn.no/recommerce/forsale/item/466129966", ...}
```
- Popup shows the row with no badge (`badge: null`) - the user is now "following the price" of an item that can never change price. The codebase has `parseDisposed()` and maps `SoldOut` availability in `src/core/parse.ts`, but the content script never consults either signal at follow time, and finn leaves availability `InStock` after sale anyway.

### D3 (P2) - Most sold listings: no button, silent (same silent-no-op class as D1)
- Listing: https://www.finn.no/recommerce/forsale/item/465266905 ("Hardanger Bestikk Carina 24 deler"), visible "Solgt" badge, page up, HTTP 200.
- Expected: some defined behavior (e.g. disabled button "Solgt", or nothing by design - but then D2 is inconsistent with it).
- Actual: no Product JSON-LD on sold pages of this variant -> no button. Combined with D2, sold-listing behavior is inconsistent: some sold pages are trackable as active, others show nothing. (3 more sold listings sampled - 464629734, 464597690, 464893994 - all behave like this one.)

### D4 (P3) - Free "gis bort" listings cannot be tracked, with zero feedback
- Listings: https://www.finn.no/recommerce/forsale/item/459482468 ("Gammel sofa gis bort"), https://www.finn.no/recommerce/forsale/item/446070327 ("Gis bort")
- Expected per spec: tracking works for price-0 listings or degrades sanely.
- Actual: finn serves no Product JSON-LD for free listings, so no button injects (verified in-browser, 8s wait, shadow-piercing search). No crash, no storage corruption - degradation is "sane" but completely silent. Note this is NOT a price===0 guard bug (a 0 price would pass the `price === null` check); the data simply is not there.

### D5 (P3) - Emoji titles stored and displayed as literal `\u{...}` escape junk
- Listing: https://www.finn.no/recommerce/forsale/item/338298867
- Page H1/og:title: `Flipper 1 Vhs 🔥FORSEGLET!! ⚠️NY PRIS‼️` (real emoji)
- finn's JSON-LD `name` is mangled at the source: `Flipper 1 Vhs \u{d83d}\u{dd25}FORSEGLET!! \u{26a0}️NY PRIS‼️` (literal backslash-u-brace text, not real characters)
- Actual stored title and popup row text: the mangled string, verbatim. Upstream cause is finn's JSON-LD encoder, but og:title on the same page is correct and could be preferred/sanitized. XSS-wise the popup is fine: titles are escaped via `esc()`, raw `<a>` innerHTML inspected and confirmed text-only.
- Storage excerpt: `"title":"Flipper 1 Vhs \\u{d83d}\\u{dd25}FORSEGLET!! \\u{26a0}️NY PRIS‼️"`

### D6 (P4) - Mobility: tracked price can differ from the price the button sits next to
- Listing: https://www.finn.no/mobility/item/351790087 (Harley-Davidson FXSTC)
- Page headline price (totalpris incl. fees): "165 613 kr" - this is the element the button anchors to. JSON-LD price (asking price excl. omreg): 165000.
- Actual: button + inline widget render directly under "165 613 kr" while the widget says "Lavest: 165 000 kr / Hoyest: 165 000 kr" and the popup shows "165 000 kr". Same pattern on https://www.finn.no/mobility/item/304790876 (headline 62 844 kr vs JSON-LD 62 500). Dealer cars tested happened to have matching values. Cosmetic/consistency issue, but it looks like a wrong number to a user.
- Related observation: private-seller car https://www.finn.no/mobility/item/372698519 stores title "Andre" (JSON-LD make "Other") so the popup row is just "Andre" - technically non-empty, but useless as identification; og:title is "Bruktbil til salgs: Andre - 1959 - Rod - 18 hk - Cabriolet".

## What passed cleanly (verified evidence)

- Storage shape on all 11 tracked entries: numeric-string `id`, `url`, non-empty `title`, `image` always a string (Mobility's ImageObject arrays correctly flattened to URL string), `addedAt`, `status:"active"`, `history` = `[{ts, price:number}]` with the JSON-LD price as a number.
- Popup after every one of 16 opens: 0 pageerrors, 0 console errors, correct count label ("N fulgt"), every row had title link, "N kr"-formatted price (nb-NO spacing), sparkline `<svg path d="M2.0,16.0 L118.0,16.0">`, image and working remove button.
- Toggle semantics: follow -> "Folges ✓" + inline history widget ("Torgvakt prishistorikk... Lavest/Hoyest/1 punkt"); unfollow from page -> label back to "Folg pris", widget removed, storage entry deleted. Unfollow from popup -> row removed, count decremented, storage entry deleted.
- Dealer-ad anchor check: monthly financing elements exist on all mobility pages tested ("fra 859 kr/mnd" etc.); button never anchored to them.
- Consent wall: injection works with the Sourcepoint dialog up and unanswered.

## Environment notes (not extension defects)

- finn.no consistently logs one `503` console resource error per page (their own beacon) - present with and without the extension.
- finn's reduced/no-LD pages throw their own `pageStateTracker` pageerrors.
