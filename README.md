# Squeek Clicker

A playable, 60-second pixel mouse clicker for the Squeekchain community. The production website is included in **`dist/`** alongside its TypeScript, HTML, CSS, local artwork, fonts, package manifest, and lockfile.

## Run and rebuild

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Vite prints the development URL. To build and preview the exact static export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Serve `dist/` with any static HTTP server. The Vite base is `./`; HTML, scripts, styles, fonts, mascot, favicon, and share image use relative URLs and work under a gateway subpath. There are no runtime third-party requests, backend, wallet flows, or transactions. Opening the source `index.html` directly as a file is not the preview workflow.

## Play

Select **Start Game**, then tap the mouse. On desktop, focus the mouse and press Space or Enter. Holding a key does not generate repeated points.

Each round runs for 60 seconds. Consecutive taps within 600 milliseconds build a combo: tap 5 unlocks 2×, tap 10 unlocks 3×, tap 15 unlocks 4×, and tap 20 unlocks 5×. A longer gap resets the combo to 1×. Opening help or leaving the tab keeps the deadline running. Taps at or after the deadline earn no points.

The results screen shows points, total taps, and maximum combo. **Play Again** starts a fresh round. **Reset** confirms before discarding an active round and preserves saved scores. The trash control separately confirms clearing the saved personal best and history. Sound starts off and can be enabled in the header.

## Personal scores

Only completed rounds enter the local leaderboard. The browser stores the most recent 30 rounds and an all-time personal best under `squeek-clicker:v1`. Top scores and Recent each show five rounds; the count explains the subset. The best survives history trimming. A new browser or origin has a separate record. Clearing browser data removes it. Simultaneous tabs use the last saved storage value.

There are no seeded players or global rankings. Invalid saved data is discarded safely. If browser storage is unavailable, the game still works and explains that scores last for the current visit.

## Validation

Actual final results:

| Check | Result |
| --- | --- |
| Production build | Passed; complete export in `dist/` |
| TypeScript typecheck | Passed |
| Rule and storage tests | 9 passed |
| Chromium interaction checks | 14 passed; 0 failed |
| Pinned taste@1 probe | 16 of 16 checks passed |
| Responsive layout | Checked at 320, 390, 768, 1024, and 1440 CSS pixels |
| Enlarged text | 200% root text size checked at 390px without horizontal overflow |

The interaction suite serves the **built export** at `/preview/`, uses touch and keyboard input, and accelerates time with Playwright’s [Clock API](https://playwright.dev/docs/clock). It checks combo scoring and decay, deadline enforcement, replay, reload persistence, sorting, reset/clear confirmations, modal focus, sound toggle state, reduced motion, unavailable/corrupt storage, resources, and overflow. It closes its server and browsers when finished.

To repeat it after building:

```sh
npm exec -- playwright install chromium
npm run test:browser
node scripts/check-export.mjs
```

The suite also attempts WebKit and reports a limitation if its runtime cannot launch. In this validation, WebKit did not launch. Physical iPhone/Android testing, screen-reader testing, browser-native zoom, and audible sound verification remain unperformed. A Chromium phone emulation is not a physical device test. The probe leaves six text boxes over scene artwork/gradients unmeasured for contrast; its pass is not a full accessibility certification.

The pinned design probe was also run from the repository root:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

That probe is an assignment input and is removed from the delivered repository. Its final results are preserved in [artifacts/taste-results.json](artifacts/taste-results.json). Full coverage, corrected findings, and limitations are in [VALIDATION.md](VALIDATION.md), with a delivery copy under `artifacts/`. Screenshots and browser results are included under `artifacts/`; disposable test output goes to `test/scratch/`.

## Static delivery and IPFS

The complete `dist/` directory is ready for IdentityMD’s publishing step, which pins the submitted export to IPFS. The publicly accessible URL is assigned after submission and was not available during this implementation. No CID or public deployment URL is claimed here. The share image uses a relative path because the eventual gateway address is assigned at publication.

Keep source, lockfile, documentation, and `dist/` together in the submission. Dependencies and caches are not part of delivery. No ignore file was changed. `scripts/check-export.mjs` checks the export references and exact delivered-path byte total against the 8,388,608-byte budget; its report is [artifacts/export-results.json](artifacts/export-results.json).

## Source map and assets

- `src/game.ts`: clock-independent game rules.
- `src/storage.ts`: validation, best-score retention, bounded history.
- `src/main.ts`: screens, input, local leaderboard, dialogs, feedback, audio.
- `src/style.css`: tokens, components, breakpoints, motion preferences.
- `public/assets/`: original mouse and favicon SVGs, generated share PNG, font licenses.
- `src/assets/`: bundled Silkscreen 400 and DM Sans 400/600 WOFF2 files.
- `tests/`: repeatable rule and production-browser validation.
- `DESIGN.md`: the final implemented design system.

`npm run generate:share` regenerates the 1200 × 630 PNG from the original SVG mascot and local font using Playwright Chromium. Rebuild afterward to copy it into `dist/`.

Silkscreen and DM Sans are included under the SIL Open Font License; notices are in `public/assets/licenses/`. Design review applied Jakub Krehel’s [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface) (MIT). Design documentation used the method adapted from Paul Bakaus’s [Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md) (Apache-2.0). Their included license notices are preserved in `licenses/design-guidance.txt`.
