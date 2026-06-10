# Torgvakt

Chrome-utvidelse: prishistorikk og prisvarsler for FINN.no Torget.

## Dev

- `npm install`
- `npm run build` -> dist/ (load unpacked via chrome://extensions, Developer mode)
- `npm test` (vitest unit tests)
- `npm run e2e` (Playwright popup tests with the built extension)
- `npm run smoke -- <listing-url>` (live content-script check against finn.no)
- `npm run package` -> torgvakt.zip for Chrome Web Store upload

## Architecture

Pure client-side MV3 extension, zero runtime dependencies, no backend.
Pure logic in `src/core/` and `src/shared/` (unit tested), thin chrome-bound
entry points in `src/content/`, `src/background/`, `src/popup/`.
Listing data is parsed from finn.no's schema.org JSON-LD. The listing UI on
finn.no lives in declarative shadow DOM, so injected elements use inline styles
and shadow-piercing traversal (`src/content/dom.ts`).

Strategy and product docs live in the personal vault under `Projects/Torgvakt/`
(not in this repo).
