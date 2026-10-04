# CLAUDE.md

RightNote Travel is a static, installable web app (PWA) hosted on GitHub Pages: https://magnus-eriksson-k.github.io/rightnote-travel/

It converts a cash price into the user's home currency and suggests which banknotes to hand over. Today it only supports Vietnamese đồng (VND) as the currency you type in, with AUD or USD as the result.

**Direction:** expand to other cash currencies, each with its own notes, colours and photos, while keeping the app offline-first and a single static site.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: markup, CSS and JS in one file, with note photos embedded as base64 JPEGs (~650 KB). |
| `sw.js` | Service worker. Network-first for same-origin files, falls back to cache offline. Rate APIs bypass it. |
| `manifest.webmanifest` | Install metadata: name "RightNote Travel", short name "RightNote", theme `#0f7b6c`. |
| `icon-*.png`, `apple-touch-icon.png` | Banknote-with-tick icon. The maskable and Apple versions are padded on a solid background. |

There is no build step, framework or dependencies. Deploying means pushing to `main`; Pages serves the repo root.

## Releasing a change

1. Edit the files.
2. **Bump `VERSION` in `sw.js`** (e.g. `rightnote-v3` → `rightnote-v4`). Without this, installed copies keep serving the old cache.
3. Run a syntax check on the inline script: extract the `<script>` body and run `node --check`.
4. Commit and push to `main`. Pages redeploys in about a minute.

## How index.html works

- **Currencies:** `CUR` holds each currency's value as **VND per 1 unit**, with symbol and decimal places. VND is the pivot (`vnd: 1`). The rate between two currencies is `CUR[base].vnd / CUR[second].vnd`.
- **Sides:** `second` is the currency you type in, fixed to `"VND"`. `base` is the result currency, selectable and stored in `localStorage`. The rate shown is "1 base = X second".
- **Input:** `expr` is a typed expression evaluated by a tiny parser in `evaluate()` (`+ - × ÷`, operator precedence, no `eval`).
- **Custom rate:** `custom = {pair, r}` overrides the rate for one base+second pair. "Reset rate" clears it, and a refresh replaces it.
- **Notes:**
  - `VND_NOTES` lists polymer notes with two gradient colours each. Entries with no colours are plain amounts.
  - `NOTE_INFO` holds the back image and colour description for each note.
  - `PAY_NOTES` is every denomination used for payment, including the paper 1k/2k/5k notes.
- **Photos:** `photos` maps each denomination to a `data:` URI; `photoSrc()` also accepts asset ids. The photo-upload UI is still in the file but stays hidden, because it needs Claude-artifact storage that Pages doesn't have. To change photos, re-embed them in `photos`.
- **How to pay:** `ways(A)` returns up to three options, in this order, shown as tabs below the keypad (Exact is selected by default, and a picked tab stays picked while it's offered):
  - **Quickest:** round up to whichever total within +100k needs the fewest notes, shown only if it beats the exact option.
  - **Exact:** greedy fewest notes for the exact amount (greedy is optimal for these denominations).
  - **Exact, keep Nk:** the exact amount without the largest note used.
  - The selected tab shows full note photos (repeats as one photo with a ×N badge), a colour bar of each note's share, and what to hand over. The note area is always two rows of two-column tiles high; more kinds of note get more columns instead of more rows, so the card never changes height.
  - While you type, the card dims and waits until 1.5 s after the last key (`PAY_DELAY`) before updating. `render(true)` starts that wait; a plain `render()` during a wait leaves it running, so background updates such as a rate refresh don't cut it short.
- **Rates:**
  - The default is a hard-coded snapshot from 3 Oct 2026.
  - "Refresh rate" tries `open.er-api.com/v6/latest/AUD`, then the jsDelivr `@fawazahmed0/currency-api` as a fallback.
  - Results are sanity-checked against plausible VND ranges and cached in `localStorage["rates"]`.
  - The app refreshes automatically once a day when online, unless a custom rate is active.
- **Views:** three in-page views. Calculator and Notes are switched in the header; Options opens from the gear icon at the right of the header (tapping it again closes it).
  - Calculator: the price, keypad, payment tabs and a one-line rate summary that opens Options.
  - Notes: the note grid (with 1M/2M/5M amounts to load) and the note card.
  - Options: the exchange rate controls and Appearance.
  - `route()` picks the view from the URL hash, so the phone's back button returns to the calculator. Each trip away from the calculator adds one history entry; moving between Notes and Options replaces it.
- **Deep links:** `#notes` opens Notes; `#n2k` … `#n500k` open Notes with that note's card (tapping a note photo in the payment tabs does the same). `#options` (or the older `#rate`) opens Options.
- **Theme:** colours are CSS variables on `:root`. By default they follow the phone's light or dark setting; the Appearance section in Options (Auto, Light, Dark) can force light or dark, saved in `localStorage["theme"]` and applied as `data-theme` on `<html>` by a small script in `<head>` before the page draws. The accent comes from the app icon: `--accent` (`#0f7b6c`) fills buttons, and `--accent-text` is the green for text, which in dark mode is the icon's lighter tick green (`#3cc1a9`) so it stays readable. Note colours are passed as `--c1` (brighter, used in dark mode) and `--c2` (darker, light mode) and applied by the `.tone` class.
- **UI:** views and the note card are in-page panels (`#notesView`, `#noteDlg`), not modals. Floating popups opened off-screen or didn't work inside app viewers on the owner's phone. Keep interactions inline.

## Constraints

- Must work fully offline after the first visit, on Android Chrome and iOS Safari. Avoid runtime CDN dependencies; fonts fall back to system fonts.
- The main user is on a phone. Keep the layout compact and tap targets large, and make payment icons large enough to recognise a note at a glance.
- The note photos are the owner's own. Don't replace them with images from the web: licensing for banknote images is unclear.

## Roadmap: more currencies

The code assumes VND in a few places. To generalise:

1. **Per-currency note data:** replace `VND_NOTES`, `NOTE_INFO`, `PAY_NOTES` and `photos` with a structure keyed by currency code, holding each note's colours, info, photo, the smallest cash unit and the local shorthand (`vnShort` is VND-specific).
2. **Rates against any pivot:** keep the "value per pivot unit" model, but fetch rates for all supported currencies in one call rather than VND/AUD/USD only. Adjust the sanity ranges per currency.
3. **Selectable entry currency:** turn `second` back into a selector limited to currencies that have note data. Fixing it to VND was deliberate, because only VND has photos.
4. **Photos:** consider separate image files cached by the service worker instead of base64 in `index.html`, so the page stays small as currencies are added.
5. **Rounding:** `payAmount()` rounds up to 1,000 for VND. This should use each currency's smallest cash denomination.
