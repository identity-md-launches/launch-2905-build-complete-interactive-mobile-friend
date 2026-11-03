# Squeek Clicker design system

## Overview

Squeek Clicker is a quick arcade game for the Squeekchain community. Its visual idea is a small lavender pixel mouse at the center of a dark arcade cabinet, with lime points and purple combo feedback. The welcome screen leads directly to play. Instructions and device-only scores are supporting content.

The implementation uses HTML, vanilla TypeScript, and CSS with Vite. `src/style.css` is the token source; `src/main.ts` supplies the DOM patterns and behavior. The original mascot and favicon are SVG artwork in `public/assets/`. There is one dark theme and one English interface.

## Colors

These are the exact semantic tokens in `src/style.css:5`. Components use tokens rather than a second palette.

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#0c0e12` | Page and game scene |
| `--color-surface` | `#13171d` | Cabinet, score/combo areas, dialogs |
| `--color-surface-raised` | `#1b2028` | Keycap and utility hover |
| `--color-surface-hover` | `#252b35` | Secondary action |
| `--color-border` | `#2d333d` | Separators and inactive combo bars |
| `--color-border-strong` | `#4a535e` | Cabinet outline and keycaps |
| `--color-text` | `#f0f2ed` | Headings, labels, primary content |
| `--color-text-secondary` | `#a2abb7` | Supporting copy and dates |
| `--color-accent` | `#b4f77c` | Primary action, points, record feedback |
| `--color-accent-hover` | `#caff9d` | Primary action hover |
| `--color-on-accent` | `#18220f` | Text and icons on the lime action |
| `--color-combo` | `#bd9bf6` | Time, combo levels, supporting icons |
| `--color-combo-soft` | `#29213a` | Step-number background |
| `--color-warning` | `#ffbf91` | Final ten seconds and storage warning |
| `--color-focus` | `#d5beff` | Two-pixel focus ring |

The art has its own lavender, pink, and cheese colors inside the SVG. Scene-only translucent grid, stars, and platform are decoration, not a second interface palette. Score and combo states also have text; color is not their sole signal. See validation for measured solid-background contrast coverage and the six scene text boxes the probe did not measure.

## Typography

Two families are bundled locally. `--font-body` is DM Sans with Arial/sans-serif fallback, at weights 400 and 600. `--font-pixel` is Silkscreen 400 with Courier New/monospace fallback. Its glyph shapes look like arcade capitals while source copy remains in natural case. Pixel type is reserved for identity, short game headings, scores, ranks, and multiplier data. Instructions and prose use DM Sans.

| Size token | Default | Use |
| --- | --- | --- |
| `--text-small` | 14px / 0.875rem | Supporting copy, labels, dates |
| `--text-body` | 16px / 1rem | Buttons, body, step titles |
| `--text-section` | 20px / 1.25rem | Sidebar headings, wordmark |
| `--text-title` | 24px / 1.5rem | Scene headings, mobile headline/stats |
| `--text-display` | 40px / 2.5rem | Desktop headline/stats, mobile result |
| `--text-score` | 56px / 3.5rem | Desktop final score |

Body line-height is 1.5; step copy and dialog paragraphs use 1.6. Headings use 1.2–1.3 and balanced wrapping. The main headline uses `-0.04em` tracking; other text keeps natural spacing. Numbers use tabular numerals. Scores can wrap instead of being clipped. Text remains selectable outside the tap target. All three font faces were observed loaded in Chromium.

## Layout

Spacing tokens are 4, 8, 12, 16, 24, 32, and 40px (`--space-1` through `--space-10`). Local 6, 10, and 20px adjustments serve icon gaps and compact rows. Shared `.shell` edges align the header, intro, cabinet/sidebar composition, and footer.

The shell is at most 1200px, otherwise viewport minus 80px. At 1130px it uses 24px side margins and a 280px sidebar; the normal sidebar is 300px. At 860px, the cabinet becomes a single column and the supporting sidebar becomes two columns below it. Through 760px, the header uses the compact wordmark, icon-only Sound and Help buttons with accessible names, 8px utility gaps, and a shorter Connect label with 10px inline padding. Through 400px the wordmark shows only its mouse icon and retains its full accessible name. At 560px, margins are 16px, the sidebar stacks, the headline is 24px, and the cabinet statistics use 24px values. At 350px margins are 12px and the combo hint gets a separate line.

The header minimum height is 100px, then 84px under 860px, then 72px under 560px. The mobile wordmark can wrap when text is enlarged. The scene uses minimum heights of 420px desktop and 348px phone, and grows with content. Controls remain in document flow. Decorative overflow is clipped inside the scene-art layer. The footer respects the bottom safe-area inset.

Chromium layouts were checked at 320, 360, 375, 390, 400, 401, 560, 561, 600, 640, 760, 761, 768, 1024, and 1440px in disconnected, wrong-network, and connected states. At 390 × 844, the mascot and Start Game are fully visible on the first screen. Enlarging root text to 200% reflows without horizontal overflow; this was not native browser zoom. Header height, intro spacing, and the game's vertical position are unchanged by the compact-header revision.

The Web3 section follows the game and uses the same surface, border, radius, spacing, and typography tokens. `.web3-grid` has four columns on desktop, two through 1130px, and one through 560px. `.w3-card` uses 24px padding, reduced to 16px through 560px. Addresses wrap in full in the wallet card. The native `.wallet-sheet` is at most 420px wide; through 639px it becomes a bottom sheet with a safe-area inset and 48px minimum rows.

## Elevation & Depth

Surfaces are flat. The cabinet uses one structural outline and lime pixel corner marks, not an elevation shadow. Internal separators divide statistics, scene, combo, and status. The mouse’s dotted floor platform and perspective grid give the artwork a sense of place. Floating score text uses a small dark text-shadow for legibility.

Native dialogs enter the browser top layer with a `#05060bd9` backdrop. The underlying page is inert. Scene effects use z-index 3 and `pointer-events: none`; decorative art sits behind controls. The skip link appears above the page when focused.

## Shapes

The cabinet and utilities use an 8px radius, primary/secondary buttons 4px, dialogs 12px, and the mouse tap target 48px. Step numerals and pixel artwork stay square. The platform is elliptical. Structural borders are 1px; focus and cabinet corner accents are 2px. Avoid adding nested framed cards to the sidebar.

## Components

| Pattern | Source | Behavior and states |
| --- | --- | --- |
| Header / utilities | `src/main.ts`, `.site-header`, `.wordmark`, `.utility` | Sound toggle exposes `aria-pressed`; help has a permanent accessible name. Utilities and wordmark are at least 44px high. |
| Wallet control / sheet | `src/web3/dashboard.ts`, `.wallet-button`, `.wallet-row`, `.wallet-sheet` | Connect opens the native dialog; detected wallets have their own rows. Wrong-chain status offers Switch to Sepolia. The connected control shows a short address and opens the dashboard's details and Disconnect. Tab, Escape, visible focus, and focus return follow the native modal pattern. |
| Web3 dashboard | `src/web3/dashboard.ts`, `.web3-grid`, `.w3-card`, `.w3-list` | Connection state, full address, network, Sepolia ETH/SQK balances, block reads, official wheel API, and sourced contracts. A new balance owner resets both amounts to Loading synchronously; same-account refreshes retain their values. Failed reads show an unavailable state. Warning uses `--color-warning`; connection state also has text. |
| Primary action | `.button.primary`, `#start`, `#again` | Lime fill, 52px minimum height; 48px on phones. Explicit hover, pressed, focus states. One main action is visible per game screen. |
| Cabinet / statistics | `.game-panel`, `.scoreboard`, `.stat` | Three aligned values, labeled timer, stable number styles, progress line. Personal best is the saved completed-round record. |
| Game screens | `showPhase`, `start`, `finish`, `reset` in `src/main.ts` | Welcome, playing, and over use `hidden` for inactive content. Start focuses the mouse; completion focuses Play Again unless a dialog is open. |
| Mouse target | `#mouse-target`, `tap`, `.mouse-target` | Native button: pointer, touch, Space, Enter. Held keys are ignored. Desktop target is 272 × 256px; phone target 224 × 216px. Focus has room before the instruction line. |
| Tap effects | `tap`, `.score-float` | Point value, 140ms mascot press response, 650ms float. The target button stays the same size so rapid taps do not move its hit area or focus perimeter. At most 32 floats; every node is removed. Under reduced motion the float is static and press movement is disabled. |
| Combo meter | `.combo-panel`, `#combo-levels`, `renderRound` | Five labeled levels and a 600ms decay indicator; accessible numeric meter value and textual per-tap reward. |
| Saved scores | `renderLeaderboard`, `.score-tabs`, `.score-row` | Empty state, top/recent pressed buttons, dated local rows, count, clear action. Up to five displayed rows from the latest 30 stored rounds. Storage failure gets a persistent warning. |
| Dialogs | `#help-dialog`, `#confirm-dialog`, `confirm` | Native modal semantics, Tab wrap, Escape dismissal, focus return. Reset/clear describe their exact consequences; cancel is initially focused for confirmation. |
| Announcements | `#announcer` | Stable polite live region announces start, combo level changes, final ten seconds, completion, reset, and clear. Every tap is not announced. |

Hover colors are restricted to devices with hover. Motion runs only under `prefers-reduced-motion: no-preference`. Button press scale is 0.96 and transitions name their properties. There is no looping scene animation or autoplay sound.

## Do’s and Don’ts

- Reuse `.shell`, the semantic color tokens, and the six size roles. Use DM Sans for explanations and Silkscreen for short arcade text and numbers.
- Keep the main game action ahead of supporting instructions on phones. Use a native button for every action and keep decorative layers out of hit testing.
- Keep saved scores explicitly local. New states must have textual feedback, keyboard access, and reduced-motion behavior.
- To add another game view, place its section inside `.playfield`, use the existing `.screen` and action patterns, update focus when changing views, then check narrow widths and text enlargement.
- Keep the existing flat cabinet composition. Avoid global ranking claims, remote font dependencies, additional type scales, and multiple competing filled actions.

This document records the implemented source. Browser, screen-reader, and publication limitations are in `VALIDATION.md`.
