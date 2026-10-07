# CLAUDE.md

RightNote Travel is a static, installable web app (PWA) hosted on GitHub Pages: https://magnus-eriksson-k.github.io/rightnote-travel/

It converts a cash price into the user's home currency and suggests which banknotes to hand over. Today it only supports Vietnamese đồng (VND) as the currency you type in, with AUD or USD as the result.

**Direction:** expand to other cash currencies, each with its own notes, colours and photos, while keeping the app offline-first and a single static site.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: markup, CSS and JS in one file (~50 KB). |
| `img/vnd/` | Note photos: `<denomination>-back.jpg` and `<denomination>-front.jpg`. |
| `data/cities.json` | Built-in city guides (Hà Nội, Hồ Chí Minh City, Đà Nẵng, Hội An, Huế) plus per-country customs and phrases. Precached, so they work offline. |
| `sw.js` | Service worker. Precaches the app and every note photo (`FILES`); network-first for same-origin files, falls back to cache offline. Rate APIs bypass it. |
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
- **Photos:** `backs` holds the back of each note and `photos` the front, each mapping a denomination to a file path in `img/vnd/`; `photoSrc()` passes paths and `data:` URIs through and treats anything else as an uploaded asset id. `pic(d)` returns the back, falling back to the front, and every note tile uses it. The note card shows both sides (back first), each with a caption. The photo-upload UI is still in the file but stays hidden, because it needs Claude-artifact storage that Pages doesn't have. To change a photo, replace its file in `img/vnd/`. To add one, add the file, its path in `backs` or `photos`, and the path to `FILES` in `sw.js` so it works offline.
- **How to pay:** `ways(A)` returns up to three options, in this order, shown as tabs below the keypad (Exact is selected by default, and a picked tab stays picked while it's offered):
  - **Quickest:** round up to whichever total within +100k needs the fewest notes, shown only if it beats the exact option.
  - **Exact:** greedy fewest notes for the exact amount (greedy is optimal for these denominations).
  - **Exact, keep Nk:** the exact amount without the largest note used.
  - The selected tab shows full note photos (repeats as one photo with a ×N badge), a colour bar of each note's share, and what to hand over. The note area is always two rows of two-column tiles high; more kinds of note get more columns instead of more rows, so the card never changes height.
  - **Checking change:** when an option gives change, "₫X back" is a button that opens a checker below it in the card (`changeBox()`). It shows every note up to the change amount in a two-column grid; tap a note each time you're given one (×N badge, "−" to undo, "Clear" to start over). The total turns green with "✓ Correct" when it matches, and warns when it's too much. The count (`got`) resets when the change amount changes.
  - While you type, the card dims and waits until 1.5 s after the last key (`PAY_DELAY`) before updating. `render(true)` starts that wait; a plain `render()` during a wait leaves it running, so background updates such as a rate refresh don't cut it short.
- **Rates:**
  - The default is a hard-coded snapshot from 3 Oct 2026.
  - "Refresh rate" tries `open.er-api.com/v6/latest/AUD`, then the jsDelivr `@fawazahmed0/currency-api` as a fallback.
  - Results are sanity-checked against plausible VND ranges and cached in `localStorage["rates"]`.
  - The app refreshes automatically once a day when online, unless a custom rate is active.
- **Views:** five in-page views. Pay, Phrases and City are switched in the header; Options opens from the gear icon at the right of the header (tapping it again closes it).
  - Pay (`#calcView`, the calculator): the price, keypad, payment tabs and a one-line rate summary that opens Options. "See all notes ›" on the How to pay card opens Notes.
  - Notes: a sub-page of Pay (the Pay tab stays highlighted, "‹ Pay" goes back): the note grid (with 1M/2M/5M amounts to load) and the note card.
  - Phrases: phrases for the current City's country, else the country whose `cur` is the currency you pay in. Groups come from `countries.<CC>.phrases` in `data/cities.json` (`t` local text, `say` rough pronunciation, `en`, optional `note`; groups may have a `note`). Tapping a phrase shows it large inline, to hold up to someone; "🔊 Hear it" uses `speechSynthesis` with a voice matching the country's `lang`, and is hidden when the phone has none.
  - City: weather and a travel guide for where you are (see **City** below).
  - Options: the exchange rate controls, Appearance, and "Install on your phone" (iPhone and Android steps, this phone's first; a one-tap Install button when Chrome offers `beforeinstallprompt`). The install section hides when the app runs from the home screen.
  - `route()` picks the view from the URL hash, so the phone's back button returns to the calculator. Each trip away from the calculator adds one history entry; moving between Notes and Options replaces it.
- **Deep links:** `#notes` opens Notes; `#phrases` opens Phrases; `#city` opens City; `#n1k` … `#n500k` open Notes with that note's card (tapping a note photo in the payment tabs does the same). `#options` (or the older `#rate`) opens Options.
- **City:**
  - **Finding the place:** "Locate me" uses `navigator.geolocation`. A built-in guide city within 20 km wins (works offline); otherwise OSM Nominatim `reverse` names the town. Search by name matches built-in guides offline and asks Nominatim `search` online, on submit only (Nominatim's usage policy forbids search-as-you-type). With location already granted, opening City re-locates if the last GPS fix is over an hour old.
  - **Map:** the "Map" button next to Locate me (`mapURL()`) opens the place's coordinates in the phone's map app: `maps://` (Apple Maps) on iPhone/iPad, `geo:` (the default map app, or a chooser) on Android, and OpenStreetMap in a new tab elsewhere. It's hidden until a place is picked.
  - **Weather:** Open-Meteo (no key): current conditions, 5 days, sunrise/sunset, UV. Refreshed when older than an hour.
  - **Guide:** built-in cities render `data/cities.json` sections (`p` paragraphs, `list` bullets, `items` with optional `p` price in the city's currency). The country's `customs` are appended to each city's Customs. Prices show local and the base currency; when the city's currency is `second` they're buttons that load the amount into the calculator. Other cities use the Wikipedia summary plus the Understand/Eat/Drink/Buy/Respect/Stay safe sections of Wikivoyage (prose only, trimmed), credited as CC BY-SA 4.0.
  - **Photo:** the lead image of the city's Wikipedia article (`wiki` title for built-in cities, the matched overview article otherwise), tried from `PHOTO_SOURCES` in order: the Wikipedia article's lead image via `pageimages` (free images only); the place's Wikidata image (P18); the Wikivoyage article's banner (`wpb_banner`, shown as a 3:1 panorama); and a landscape JPEG of at least 1200 px geotagged within 5 km on Commons with the place's name in its file name (largest wins). All are Commons files, with `imageinfo` for author and license. A file that won't load (an HTTP error or non-image when saving it, or the `<img>` failing while online) goes on the city's `badPhotos` list and the next source is tried, shown with a credit line under it. Images with no license or marked non-free are skipped. A found photo is re-checked after 30 days, "no photo" after a day (and never saved when a source couldn't be reached); bumping `PHOTO_V` re-checks every saved result. The file is stored in the Cache API (`rightnote-photos`, which `sw.js` keeps across versions) so it shows offline, and is removed when its city drops off Recent.
  - **Storage:** `localStorage["place"]` is the current place; `["recent"]` the last 8 non-built-in places; `["city:<id>"]` that place's saved weather, photo credit and online guide (refreshed after 30 days, removed when it drops off Recent).
  - To add a built-in city, add it to `data/cities.json` (with `lat`/`lon`, `tz`, `voy` and `wiki`, its Wikivoyage and Wikipedia titles). Bump `VERSION` in `sw.js`.
- **Theme:** colours are CSS variables on `:root`. By default they follow the phone's light or dark setting; the Appearance section in Options (Auto, Light, Dark) can force light or dark, saved in `localStorage["theme"]` and applied as `data-theme` on `<html>` by a small script in `<head>` before the page draws. The accent comes from the app icon: `--accent` (`#0f7b6c`) fills buttons, and `--accent-text` is the green for text, which in dark mode is the icon's lighter tick green (`#3cc1a9`) so it stays readable. Note colours are passed as `--c1` (brighter, used in dark mode) and `--c2` (darker, light mode) and applied by the `.tone` class.
- **UI:** views and the note card are in-page panels (`#notesView`, `#noteDlg`), not modals. Floating popups opened off-screen or didn't work inside app viewers on the owner's phone. Keep interactions inline.

## Constraints

- Must work fully offline after the first visit, on Android Chrome and iOS Safari. Avoid runtime CDN dependencies; fonts fall back to system fonts. Online-only extras (rates, weather, Nominatim, Wikivoyage) must cache their last result and degrade cleanly.
- The main user is on a phone. Keep the layout compact and tap targets large, and make payment icons large enough to recognise a note at a glance.
- The note photos are the owner's own. Don't replace them with images from the web: licensing for banknote images is unclear. City photos are different: they come from Wikimedia Commons at runtime and must always show their author and license.

## Roadmap: more currencies

The code assumes VND in a few places. To generalise:

1. **Per-currency note data:** replace `VND_NOTES`, `NOTE_INFO`, `PAY_NOTES` and `photos` with a structure keyed by currency code, holding each note's colours, info, photo, the smallest cash unit and the local shorthand (`vnShort` is VND-specific).
2. **Rates against any pivot:** keep the "value per pivot unit" model, but fetch rates for all supported currencies in one call rather than VND/AUD/USD only. Adjust the sanity ranges per currency.
3. **Selectable entry currency:** turn `second` back into a selector limited to currencies that have note data. Fixing it to VND was deliberate, because only VND has photos.
4. **Photos:** done for VND: photos are files in `img/vnd/`, precached by the service worker. New currencies get their own folder (e.g. `img/thb/`).
5. **Rounding:** `payAmount()` rounds up to 1,000 for VND. This should use each currency's smallest cash denomination.
