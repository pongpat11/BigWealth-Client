# BigWealth — UI Design Spec

> A Figma-ready design brief for the **BigWealth** money-management PWA.
> Build the frames in Figma from this document. Every token here matches the
> values already defined in `src/index.css`, so the coded app will line up 1:1
> with your Figma file.

- **Product:** Personal money management + multi-asset portfolio tracker for Thai investors
- **Primary platform:** iPhone (PWA via Safari → Add to Home Screen)
- **Secondary platform:** Desktop web
- **Base currency:** THB (฿) — every figure rolls up to baht
- **Tone:** Calm, trustworthy, "private bank in your pocket." Lots of white space, soft cards, one confident accent color.

---

## 1. Design principles

1. **Mobile-first, thumb-first.** Primary actions sit in the bottom half of the screen. Bottom tab bar for navigation. Nothing critical hides behind a hover.
2. **Money is the hero.** Big, tabular-number figures. Currency always formatted (`฿1,234,567`). Gains green, losses red — never rely on color alone (use +/− signs and arrows too).
3. **Cards over chrome.** Content lives in soft rounded cards on a light gray canvas. Minimal borders, gentle shadows.
4. **One accent.** Emerald green = brand/growth. Gold = wealth/assets accent only. Avoid rainbow UIs except in category chips and charts.
5. **Glanceable, then deep.** Dashboard answers "am I OK?" in 2 seconds. Detail screens allow drill-down.
6. **Accessible.** WCAG AA contrast, 44×44px min tap targets, visible focus rings, `prefers-reduced-motion` respected.

---

## 2. Figma file structure

Create one Figma file: **`BigWealth — App Design`** with these pages:

| Page | Contents |
|---|---|
| `🎨 Foundations` | Color styles, text styles, effect styles, spacing/radius notes, grid styles |
| `🧩 Components` | The component library (buttons, cards, nav, list rows, charts) as Figma components with variants |
| `📱 Mobile` | All screens at 390×844 (iPhone 14/15) |
| `🖥️ Desktop` | All screens at 1280×800 |
| `🌊 Flows` | Key flows wired with prototype links (add transaction, create goal, etc.) |
| `📥 Archive` | Old explorations |

**Frame sizes**
- Mobile: **390 × 844** (iPhone 14/15). Account for a 47px top safe area + 34px bottom home-indicator inset.
- Desktop: **1280 × 800** min, content max-width **1120px** centered.

---

## 3. Color tokens

Create these as Figma **color styles** (group by `brand/`, `semantic/`, `surface/`).

### Brand — Emerald
| Token | Hex | Use |
|---|---|---|
| `brand/50` | `#ecfdf5` | gain chip backgrounds |
| `brand/100` | `#d1fae5` | subtle fills |
| `brand/500` | `#10b981` | progress bars, secondary brand |
| `brand/600` | `#059669` | **primary buttons, active nav, key figures** |
| `brand/700` | `#047857` | button hover |
| `brand/800` | `#065f46` | button pressed |

### Gold accent
| Token | Hex | Use |
|---|---|---|
| `gold/400` | `#fbbf24` | gold-asset chips, premium accents |
| `gold/500` | `#f59e0b` | gold class in charts |

### Semantic (finance)
| Token | Hex | Use |
|---|---|---|
| `gain` | `#059669` | income, positive P&L, up arrows |
| `loss` | `#e11d48` | expense, negative P&L, down arrows |
| `warn` | `#f59e0b` | budget 80–100% |

### Surface / neutral (light theme)
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0f172a` | primary text, headings |
| `muted` | `#64748b` | secondary text, labels |
| `line` | `#e2e8f0` | borders, dividers |
| `surface` | `#ffffff` | cards |
| `canvas` | `#f1f5f9` | page background |

### Surface / neutral (dark theme — design later, structure now)
| Token | Hex |
|---|---|
| `ink` | `#f1f5f9` |
| `muted` | `#94a3b8` |
| `line` | `#1e293b` |
| `surface` | `#0f172a` |
| `canvas` | `#020617` |

### Chart categorical palette
`set #059669` · `us #6366f1` · `fund #0ea5e9` · `crypto #f59e0b` · `gold #fbbf24` · `cash #94a3b8`

---

## 4. Typography

**Font:** Inter (Latin) + IBM Plex Sans Thai (Thai). Both free on Google Fonts.
Numbers use **tabular figures** (`font-feature-settings: 'tnum'`) so columns align.

Create these Figma **text styles**:

| Style | Size / Line | Weight | Use |
|---|---|---|---|
| `display` | 32 / 38 | 700 | Net-worth hero figure |
| `h1` | 24 / 30 | 700 | Page titles |
| `h2` | 18 / 24 | 600 | Card titles, section headers |
| `body` | 15 / 22 | 400 | Default text |
| `body-strong` | 15 / 22 | 600 | Amounts in rows |
| `label` | 13 / 18 | 500 | Field labels, nav labels |
| `caption` | 12 / 16 | 400 | Timestamps, helper text |
| `num-lg` | 28 / 34 | 700 · tnum | Card stat figures |
| `num-md` | 16 / 22 | 600 · tnum | List-row amounts |

---

## 5. Spacing, radius, elevation, grid

- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32, 48. Default gutter = 16. Card padding = 16.
- **Radius:** inputs/buttons **12px**, cards **16px**, chips/pills **full**.
- **Elevation (card shadow):** `0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06)`. One level only — don't stack shadows.
- **Mobile grid:** 4 columns, 16px margins, 16px gutter.
- **Desktop grid:** 12 columns, 1120px max, 24px gutter; sidebar 240px fixed + fluid content.

---

## 6. Component inventory

Build each as a Figma component with variants. States to cover everywhere: **default / hover / pressed / focus / disabled** and where relevant **loading / empty / error**.

### Buttons
- **Primary** — `brand/600` fill, white text, radius 12, h 40 (md) / 32 (sm). Hover `brand/700`, pressed `brand/800`.
- **Secondary** — `canvas` fill, `line` border, `ink` text.
- **Ghost** — transparent, `muted` text, hover `canvas` fill.
- **FAB (mobile)** — 56×56 circular `brand/600`, white `+`, floating bottom-right above tab bar (offset 16px + safe area). Casts elevation.

### Inputs
- Text field: h 44, radius 12, `surface` fill, `line` border; focus = 2px `brand/500` ring. Label `label` style above. Error = `loss` border + caption.
- Select / category picker, date picker, amount field (large right-aligned tnum, with ฿ prefix), segmented toggle (Income | Expense | Transfer).

### Card
- `surface` fill, radius 16, card shadow, 16 padding. Optional header row: `h2` title left + ghost action right.

### Stat card (dashboard tiles)
- Label (`caption`, muted) → big figure (`num-lg`) → delta chip (gain/loss with arrow). Optional sparkline.

### Badge / chip
- Pill, `caption` weight 500. Tones: neutral, gain (`brand/50`+`brand/700`), loss (`rose/50`+`loss`), gold, brand-solid.

### Progress bar
- h 8, full radius, track = `canvas`. Fill auto-tones: **<80% green, 80–100% amber, >100% red**. `aria-valuenow`.

### List row (transactions / holdings / accounts)
- Left: 36px round category/asset icon (colored bg at 12% tint). Middle: title (`body-strong`) + subtitle (`caption` muted). Right: amount (`num-md`, gain/loss colored) + sub-line. Min height 56, full-width tap target, 1px `line` divider.

### Navigation
- **Mobile bottom tab bar:** fixed bottom, `surface` fill, top `line` border, 5 items, safe-area padding. Active = `brand/600` icon+label, inactive = `muted`. Tabs: **Home, Transactions, Portfolio, Budgets, More**.
- **Desktop sidebar:** 240px, logo top, vertical nav list (icon + label, active = `brand/50` pill bg + `brand/700` text), user chip bottom.
- **Top bar (mobile):** page title + optional right action (filter/add). Transparent over canvas.

### Charts (Recharts in code; mock visually in Figma)
- **Donut** — asset allocation, 12px ring, center shows total ฿ + "Net Worth". Legend below with % and colored dots.
- **Area/line** — net-worth trend, `brand/500` stroke + 12% gradient fill, rounded dots on hover, tooltip card.
- **Grouped bars** — cash flow income (brand) vs expense (loss), per month.
- **Horizontal bars** — spending by category.

### Feedback
- Toast/snackbar (bottom, above the tab bar on mobile; bottom-right on desktop; auto-dismiss), inline alert (info/success/warn/error), skeleton loaders (shimmer on canvas), empty-state (centered icon + title + subtitle + CTA), error-state (retry button).

### Delete pattern (all screens)
- **One tap, then Undo — never "tap twice to confirm".** The item leaves the list at once and an undo snackbar ("Deleted “Wallet”" · **Undo** · ×) stays for 5 s with a countdown line. The API call is sent when the snackbar closes (timeout, ×, a second delete, leaving the screen, or closing the app). If the server refuses, the item comes back and a red snackbar gives the reason.
- **Row-level:** a 40 px trash icon (`DeleteButton`, muted → loss red on hover), labelled "Delete ‹name›" for screen readers. Default (built-in) items show a *Default* badge instead.
- **In an edit sheet:** full-width "Delete ‹thing›" text button with a trash icon under Cancel / Save; tapping it closes the sheet.
- Deleting a category also removes its sub-categories; the snackbar says so ("… and 2 sub-categories") and Undo restores them all.
- Code: `useUndoableDelete` (`src/lib/useUndoableDelete.tsx`), `DeleteButton`, `UndoToast`.

### Sheet (add / edit forms)
- Forms open in a `Sheet`: bottom sheet on phones, centred dialog ≥ 640 px, over a dimmed backdrop. Opening a row's editor never scrolls the list; Escape or tapping the backdrop closes it. Inline forms remain only for one-field adds (new category, sub-category, label).

---

## 7. Navigation map (information architecture)

```
Home (Dashboard)
Transactions ──> Transaction detail / Add-Edit modal
Portfolio ─────> Holding detail · Dividends tab
Budgets
More ──────────> Savings Goals
                 Debts
                 Reports
                 Accounts
                 Settings
```

Mobile shows 5 primary tabs (Home, Transactions, Portfolio, Budgets, More). "More" is a menu hub to the secondary screens. Desktop sidebar lists all of them directly.

---

## 8. Screen-by-screen layouts

ASCII wireframes below describe **mobile (390-wide)** unless noted. Desktop = same content reflowed into the 12-col grid with the sidebar; multi-column where space allows.

### 8.1 Dashboard (Home) — *must*
Answers "how am I doing?" at a glance.

```
┌─────────────────────────────┐
│ Good evening, Pong      ◐    │  greeting + avatar/theme
│                              │
│ ┌─────────────────────────┐ │
│ │ NET WORTH               │ │  hero card (brand gradient
│ │ ฿2,543,000              │ │  or surface w/ big figure)
│ │ ▲ +฿63,000 (2.6%) month │ │  delta chip
│ │  ╱╲    sparkline        │ │
│ └─────────────────────────┘ │
│                              │
│ ┌──────────┐ ┌──────────┐   │  2-up stat cards
│ │ Assets   │ │ Debts    │   │
│ │ ฿2.94M   │ │ ฿401K    │   │
│ └──────────┘ └──────────┘   │
│                              │
│ Cash flow — June     [⌄]     │  section header
│ ┌─────────────────────────┐ │
│ │ Income ▮▮▮▮▮ ฿67,400     │ │  grouped bars
│ │ Expense ▮▮▮  ฿37,600     │ │
│ │ Net  +฿29,800            │ │
│ └─────────────────────────┘ │
│                              │
│ Allocation                   │
│ ┌─────────────────────────┐ │
│ │     ◓  donut            │ │  donut + legend
│ │  Thai 28% US 24% ...     │ │
│ └─────────────────────────┘ │
│                              │
│ Recent          See all →    │
│ ● Lunch        −฿185         │  3–4 list rows
│ ● Uniqlo       −฿1,290       │
│ ● PTT dividend +฿2,400       │
└─────────────────────────────┘
        [Home][Txn][＋][Port][More]   tab bar + FAB
```
**Empty state:** no accounts → centered illustration + "Add your first account" CTA.

### 8.2 Transactions — *must*
```
┌─────────────────────────────┐
│ Transactions          [⚲][▦] │  search + filter
│ [ All ][Income][Expense]     │  segmented filter
│ ─────────────────────────    │
│ TODAY                        │  date group header
│ ● Lunch · Food    −฿185      │
│   Cash · 12:30               │
│ ● Uniqlo · Shopping −฿1,290  │
│ YESTERDAY                    │
│ ● BTS · Transport  −฿60      │
│ ● PTT dividend    +฿2,400 ⟳  │  ⟳ = recurring
│ ...                          │
└─────────────────────────────┘
                         (＋ FAB)
```
- Tapping a row → detail / edit modal.
- Filters: date range, account, category, type, text search. Reflect in URL query.
- **Add/Edit modal (bottom sheet on mobile):** segmented type toggle → big amount field (฿) → category grid picker → account select → date → note → Save. Validation: amount > 0, account + category required.

### 8.3 Portfolio — *must* ⭐
```
┌─────────────────────────────┐
│ Portfolio                    │
│ ┌─────────────────────────┐ │
│ │ TOTAL VALUE             │ │
│ │ ฿1,547,000              │ │
│ │ ▲ +฿186,000 (+13.7%)    │ │  total P&L vs cost
│ └─────────────────────────┘ │
│ [Holdings] [Dividends]       │  tabs
│ Allocation donut + legend    │
│ ─────────────────────────    │
│ Thai Stocks            ⌄     │  group by asset class
│ ● PTT   5,000 · ฿38.25       │
│   ฿191,250  ▲ +10.9%         │
│ ● CPALL 4,000 · ฿58.50       │
│   ฿234,000  ▼ −5.6%          │
│ US Stocks              ⌄     │
│ ● VOO  12 · $498  ▲ +21%     │
│ Crypto · Gold · Funds ...    │
└─────────────────────────────┘
```
- Each row: symbol + qty·price, market value THB, P&L % (color). Tap → holding detail (lots, avg cost, history).
- **Dividends tab:** list with **gross / withholding tax / net** columns + currency tag (SET 10% WHT, US 15–30%). Summary: total received YTD + total tax withheld. This is the ⭐ differentiator — make tax columns explicit.

### 8.4 Budgets — *must*
```
┌─────────────────────────────┐
│ Budgets        June 2026 [⌄] │  month picker
│ ┌─────────────────────────┐ │
│ │ Spent ฿22,430 / ฿28,500 │ │  overall card + ring
│ │ ▮▮▮▮▮▮▮▮░░  79%          │ │
│ └─────────────────────────┘ │
│ ● Food          ฿9,480/12,000│
│   ▮▮▮▮▮▮▮░░  green 79%       │
│ ● Shopping     ฿5,390/5,000  │
│   ▮▮▮▮▮▮▮▮▮▮ red  108% ⚠     │  overspend alert
│ ● Transport    ฿2,640/3,000  │
│   ▮▮▮▮▮▮▮▮▮ amber 88%        │
│ ...                          │
└─────────────────────────────┘
```
- Per-category progress bars auto-tone. 80% = amber nudge, 100%+ = red + ⚠ alert.

### 8.5 Savings Goals — *must*
```
┌─────────────────────────────┐
│ Goals                  (＋)  │
│ ┌─────────────────────────┐ │
│ │ New MacBook              │ │  goal card
│ │ ฿71,000 / ฿75,000        │ │
│ │ ▮▮▮▮▮▮▮▮▮▮ 95%           │ │
│ │ 2 months left · ฿2,000/mo│ │  contribution calc
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Emergency Fund   70%     │ │
│ │ ฿210,000 / ฿300,000      │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```
- Each goal: progress %, amount, days left, suggested monthly contribution = (target−saved)/months-left. Completed goals get a check + muted style.

### 8.6 Debts — *must*
```
┌─────────────────────────────┐
│ Debts                        │
│ Total owed ฿401,500          │
│ ● Car Loan · TTB             │
│   ฿285,000 left of ฿480,000  │
│   3.2% · ฿8,900/mo  ▮▮▮▮░░   │  payoff progress
│ ● Credit Card · KBank        │
│   ฿32,500 · 16% ⚠ high       │
│ ● Student Loan (กยศ.)        │
│   ฿84,000 · 1%               │
│ [ Snowball | Avalanche ]     │  payoff strategy toggle (nice)
└─────────────────────────────┘
```
- Show interest rate, min payment, % paid off. Strategy toggle reorders by smallest-balance (snowball) vs highest-rate (avalanche).

### 8.7 Reports — *must*
```
┌─────────────────────────────┐
│ Reports        [1M 3M YTD 1Y]│  range selector
│ Net worth trend              │
│  ╱╲╱  area chart             │
│ Spending by category         │
│  Food   ▮▮▮▮▮▮ ฿9,480        │  horizontal bars
│  Home   ▮▮▮▮   ฿15,000       │
│ Income vs Expense (YoY)      │
│  grouped bars per month      │
│ [ Export CSV ] [ Export PDF ]│  (nice)
└─────────────────────────────┘
```

### 8.8 Accounts — *must*
- List grouped by type (Cash, Bank, Investment, Debt). Each row: name + institution + balance (native currency + THB equivalent if non-THB). Debt rows styled red/negative. Add/Edit account form.

### 8.9 Settings — *must / nice*
- Profile (name, email, avatar), Preferences (base currency THB, locale, date format, theme light/dark), Security (change password, sessions), Notifications (budget alerts, reminders — nice), Backup & restore (nice), Connected data sources (SET/Finnhub/CoinGecko status). Logout.

### 8.10 Auth (login / register / forgot) — *must*
- Centered card: logo + tagline → email + password → primary "Sign in" → Google OAuth button → links to register / forgot. Client validation (email format, required). Error surfaces inline without reload.

---

## 9. States to design for every screen

- **Loading** — skeleton cards/rows (shimmer), never spinners-only for full pages.
- **Empty** — friendly icon + one-line explainer + primary CTA.
- **Error** — short message + Retry. Don't dump stack traces.
- **Offline (PWA)** — banner "You're offline — showing last synced data."

---

## 10. PWA / iPhone specifics

- Design a **192px and 512px app icon** (maskable, brand/600 bg + gold ฿ mark) and a splash screen.
- Respect safe areas: top notch (status bar overlaps), bottom home indicator (tab bar sits above it).
- Tap targets ≥ 44×44px. No hover-only affordances.
- Pull-to-refresh on list screens (visual only in Figma).

---

## 11. Build order (matches the product backlog)

Design in this order so we can start coding the high-value screens first:
1. Foundations + components (Figma pages 1–2)
2. Dashboard → Transactions (+ add modal) → Portfolio → Budgets
3. Goals → Debts → Reports → Accounts → Settings → Auth

---

*When the Figma frames are ready, hand back the file (or screenshots) and I'll
build them in React against the tokens and mock data already scaffolded in this
repo.*
