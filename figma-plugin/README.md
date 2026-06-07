# BigWealth UI Generator — Figma plugin

This plugin builds the BigWealth UI **inside your Figma file**: it creates the
color + text **styles** and lays out **6 mobile screens** (Dashboard,
Transactions, Portfolio, Budgets, Goals, Debts) plus a **Foundations** swatch
board — all with real auto-layout, the project's design tokens, and live chart
visuals (donut + bar charts drawn as vectors).

> Why a plugin? Figma has no write API/MCP, so frames can't be pushed in
> remotely. The Plugin API is the only way to generate real layers — you run it
> once and it draws everything.

## Run it (one-time, ~1 minute)

1. Open the **Figma desktop app** (development plugins only run there, not in the browser).
2. Open your file: **BigWealth**.
3. Menu: **Plugins → Development → Import plugin from manifest…**
4. Select this file:
   `BigWealth-Client/figma-plugin/manifest.json`
5. Run it: **Plugins → Development → BigWealth UI Generator**.
6. The canvas fills with the Foundations board + 6 screens, and the styles appear
   in your local Color/Text styles. It auto-zooms to fit.

Re-running is safe — styles are de-duplicated by name; screens are appended again
(delete the old set first if you re-run).

## What gets created

- **Color styles:** `brand/*`, `gold/*`, `semantic/*` (gain/loss/warn), `surface/*`
- **Text styles:** display, h1, h2, body, body-strong, label, caption, num-lg, num-md
- **Foundations** board: swatches + type scale
- **6 mobile frames** (390 wide) with status bar, content cards, and bottom tab bar

## Notes / limitations

- Icons are shown as single-letter chips — the Figma plugin sandbox has no access
  to the lucide icon set. Swap in real icons in Figma after generation (the chips
  are named `Icon` for easy selecting).
- Fonts use **Inter** (bundled with Figma). Thai text renders with Figma's
  fallback; install *IBM Plex Sans Thai* for production polish.
- Charts are static vector approximations of the Recharts components in the app.

## Editing

All layout + content lives in `code.js`. Tokens are at the top (`var C = {…}`),
each screen has a `buildX()` function, and `main()` lays them out. Edit and
re-import to regenerate.
