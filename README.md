# BigWealth — Client

Money management & multi-asset portfolio tracker for Thai investors. Mobile-first
PWA (iPhone) with desktop web support. Base currency: THB (฿).

Frontend of a client + server split. This repo is the **client** (Vite + React +
TypeScript). The API lives in `BigWealth-Server`.

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** — design tokens in `src/index.css`
- **React Router**, **Recharts**, **lucide-react**

## Getting started

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run lint     # eslint
npm run preview  # preview the production build
```

Requires Node.js 20.19+ or 22.12+.

## Project structure

```
src/
  components/ui/   reusable UI primitives (Card, Button, Badge, ProgressBar, …)
  data/            mock data (swapped for the API later)
  lib/             utilities (cn, THB/percent formatters)
  types/           shared domain types
  index.css        Tailwind v4 + design tokens
docs/
  DESIGN_SPEC.md   full UI design brief (tokens, components, screen layouts)
figma-plugin/      generator that builds the UI in Figma (see its README)
```

## Design

The UI is designed in Figma; the spec is in [`docs/DESIGN_SPEC.md`](docs/DESIGN_SPEC.md).
Token values there match `src/index.css` so the app and the Figma file stay in sync.
The `figma-plugin/` folder can regenerate the screens in Figma.

## CI

- **GitHub Actions** — `.github/workflows/ci.yml` (install → lint → build on push/PR)
- **GitLab CI** — `.gitlab-ci.yml` (same pipeline, if mirrored to GitLab)
