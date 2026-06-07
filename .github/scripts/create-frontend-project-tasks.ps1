# Creates frontend-only GitHub issues and adds them to user project 3.
# Prereqs: gh auth login (scopes: repo, read:project, project)
# Run from repo root: powershell -ExecutionPolicy Bypass -File .github/scripts/create-frontend-project-tasks.ps1

$ErrorActionPreference = "Stop"
$Owner = "pongpat11"
$Repo = "BigWealth-Client"
$ProjectNumber = 3
$Label = "frontend"

function Ensure-Label {
    $names = gh label list --repo "$Owner/$Repo" --json name -q ".[].name" 2>$null
    if ($names -notcontains $Label) {
        gh label create $Label --repo "$Owner/$Repo" --description "Client UI / UX work" --color "1D76DB"
    }
}

$tasks = @(
    @{
        Title = "[FE] Bootstrap BigWealth-Client (Vite + React + TypeScript)"
        Body = @"
## Scope
- Initialize app with Vite, React 18+, TypeScript (strict).
- ESLint + Prettier aligned with team defaults.
- Path aliases, env handling (``.env.example``).

## Acceptance
- ``npm run dev`` / ``npm run build`` succeed.
- README documents local setup.

## Out of scope
- API integration, auth flows.
"@
    },
    @{
        Title = "[FE] App shell: routing, layout, and navigation"
        Body = @"
## Scope
- React Router (or framework router) with public vs authenticated layouts.
- Top/side nav, active route states, 404 page.
- Responsive shell (mobile drawer / desktop sidebar).

## Acceptance
- Placeholder routes render inside shared layout.
- Navigation works on mobile and desktop widths.

## Out of scope
- Real auth guard (wire with token later).
"@
    },
    @{
        Title = "[FE] Design tokens and base UI components"
        Body = @"
## Scope
- Theme tokens (color, spacing, typography, radii, shadows).
- Base components: Button, Input, Select, Card, Badge, Spinner, Alert.
- Light theme first; structure for dark mode later.

## Acceptance
- Components documented via Storybook or a simple style guide page.
- Consistent focus states and disabled styles.

## Out of scope
- Full design system in Figma sync.
"@
    },
    @{
        Title = "[FE] Auth screens: login, register, forgot password"
        Body = @"
## Scope
- Login, register, forgot-password UI with client-side validation.
- Loading, error, and success states; accessible form labels.
- Hook up to auth API contract (mock until backend ready).

## Acceptance
- Forms validate required fields and email format.
- Errors from API surface in UI without full page reload.

## Out of scope
- OAuth providers, MFA.
"@
    },
    @{
        Title = "[FE] Auth session handling in the client"
        Body = @"
## Scope
- Store access/refresh tokens securely (httpOnly cookie preferred when available; fallback documented).
- Axios/fetch interceptor for Authorization header and 401 handling.
- Protected route wrapper + logout.

## Acceptance
- Refresh or re-login path defined for expired sessions.
- User remains on intended route after login when ``returnUrl`` is set.

## Out of scope
- Backend token issuance logic.
"@
    },
    @{
        Title = "[FE] Dashboard overview (net worth summary)"
        Body = @"
## Scope
- Dashboard home: total net worth, period change, quick stats cards.
- Skeleton loaders and empty state when no accounts linked.
- Date range selector (e.g. 1M / 3M / YTD / 1Y).

## Acceptance
- Layout matches wireframe; uses mock or API data adapter.
- Currency formatting (THB default, extensible).

## Out of scope
- Advanced analytics engine.
"@
    },
    @{
        Title = "[FE] Net worth trend chart"
        Body = @"
## Scope
- Line/area chart for net worth over selected period.
- Tooltip, legend, responsive resize.
- Library: Recharts, Chart.js, or similar.

## Acceptance
- Chart updates when date range changes.
- Accessible text alternative or data table toggle.

## Out of scope
- Export to PDF.
"@
    },
    @{
        Title = "[FE] Accounts list and account detail views"
        Body = @"
## Scope
- List accounts by type (cash, investment, debt, property).
- Detail page: balance, institution, last updated, linked holdings preview.
- Add/edit account forms (UI only; API stub).

## Acceptance
- CRUD UI flows complete with validation messages.
- Debt accounts show liability styling (negative / red semantic).

## Out of scope
- Bank aggregation / open banking.
"@
    },
    @{
        Title = "[FE] Holdings / portfolio table for investment accounts"
        Body = @"
## Scope
- Sortable, filterable table: symbol, quantity, cost basis, market value, gain/loss %.
- Row expand or side panel for position detail.
- Pagination or virtual scroll for large lists.

## Acceptance
- Sort by value and gain/loss works client-side or via API params.
- Empty and error states implemented.

## Out of scope
- Live market price streaming.
"@
    },
    @{
        Title = "[FE] Asset allocation breakdown chart"
        Body = @"
## Scope
- Donut or stacked bar by asset class (equity, fixed income, cash, alt, other).
- Drill-down from class to top holdings (optional second chart).

## Acceptance
- Percentages sum to 100%; handles rounding edge cases.
- Updates when account filter changes.

## Out of scope
- Rebalancing recommendations.
"@
    },
    @{
        Title = "[FE] Transactions list and filters"
        Body = @"
## Scope
- Transaction table: date, description, category, amount, account.
- Filters: date range, account, category, search text.
- Income vs expense visual distinction.

## Acceptance
- Filter state reflected in URL query params (shareable).
- Infinite scroll or paged fetch pattern defined.

## Out of scope
- Receipt OCR upload.
"@
    },
    @{
        Title = "[FE] Transaction create / edit modal"
        Body = @"
## Scope
- Modal or drawer to add/edit manual transactions.
- Category picker, split transaction UI stub (optional).
- Optimistic UI or explicit save feedback.

## Acceptance
- Validation prevents zero amount and missing account.
- Edit flow pre-fills existing values.

## Out of scope
- Recurring transaction rules engine.
"@
    },
    @{
        Title = "[FE] Categories management UI"
        Body = @"
## Scope
- List system + custom categories with icons/colors.
- Create, rename, archive category (UI).
- Group by income vs expense.

## Acceptance
- Cannot delete category in use without reassignment prompt.
- Changes reflect in transaction forms immediately.

## Out of scope
- ML auto-categorization.
"@
    },
    @{
        Title = "[FE] Budgets overview and progress bars"
        Body = @"
## Scope
- Monthly budget per category with spent vs limit progress.
- Over-budget warning styling.
- Month picker.

## Acceptance
- Progress bars accessible (aria-valuenow).
- Empty state when no budgets configured.

## Out of scope
- Rollover budget rules.
"@
    },
    @{
        Title = "[FE] Financial goals tracker UI"
        Body = @"
## Scope
- Goals list: name, target amount, current amount, target date, progress %.
- Create/edit goal form; optional link to account(s).

## Acceptance
- Progress calculation displayed consistently with dashboard cards.
- Completed goals visually distinct.

## Out of scope
- Monte Carlo projections.
"@
    },
    @{
        Title = "[FE] Cash flow (income vs expense) chart"
        Body = @"
## Scope
- Monthly bar chart: income, expenses, net cash flow.
- Toggle monthly vs yearly aggregation.

## Acceptance
- Respects global date filter where applicable.
- Handles months with no data.

## Out of scope
- Tax reporting.
"@
    },
    @{
        Title = "[FE] Settings: profile, preferences, and security"
        Body = @"
## Scope
- Profile: name, email display, avatar upload UI.
- Preferences: default currency, locale, date format.
- Security: change password form, sessions list placeholder.

## Acceptance
- Unsaved changes warning on navigate away.
- Preference changes persist via settings API or mock.

## Out of scope
- 2FA setup.
"@
    },
    @{
        Title = "[FE] Notifications center (in-app)"
        Body = @"
## Scope
- Bell icon with unread count; dropdown or page listing notifications.
- Mark read / mark all read; empty state.

## Acceptance
- Polling or websocket hook stub documented for backend hookup.
- Timestamps use user locale.

## Out of scope
- Email/push delivery.
"@
    },
    @{
        Title = "[FE] Global error, loading, and empty-state patterns"
        Body = @"
## Scope
- Reusable ErrorBoundary, page-level error fallback, retry button.
- Standard empty-state illustration + CTA component.
- Toast/snackbar system for success and failure messages.

## Acceptance
- At least dashboard and transactions use shared patterns.
- No unhandled promise rejections in happy path flows.

## Out of scope
- Sentry integration (separate task if needed).
"@
    },
    @{
        Title = "[FE] Responsive polish and accessibility pass (MVP)"
        Body = @"
## Scope
- Audit key flows at 320px, 768px, 1280px.
- Keyboard navigation, focus order, color contrast fixes.
- ``prefers-reduced-motion`` respected for animations.

## Acceptance
- Lighthouse a11y score ≥ 90 on dashboard (or documented exceptions).
- No horizontal scroll on mobile for primary views.

## Out of scope
- Full WCAG audit certification.
"@
    },
    @{
        Title = "[FE] API client layer and TypeScript types from OpenAPI"
        Body = @"
## Scope
- Typed API module (generated from OpenAPI or hand-written DTOs).
- Centralized base URL, error mapping, request cancellation.
- React Query (or similar) for cache keys and invalidation conventions.

## Acceptance
- Example hooks: ``useAccounts``, ``useTransactions`` with loading/error states.
- Mock adapter switch for local dev without server.

## Out of scope
- Backend OpenAPI maintenance.
"@
    },
    @{
        Title = "[FE] E2E smoke tests for critical user journeys"
        Body = @"
## Scope
- Playwright (or Cypress): login → dashboard → view accounts → log out.
- CI workflow stub to run on PR.

## Acceptance
- Tests run headless locally via documented command.
- Uses test user seed or mock auth.

## Out of scope
- Full regression suite for every screen.
"@
    }
)

Ensure-Label

$created = @()
foreach ($task in $tasks) {
    $issueUrl = gh issue create `
        --repo "$Owner/$Repo" `
        --title $task.Title `
        --body $task.Body `
        --label $Label `
        2>&1 | Select-Object -Last 1

    if ($issueUrl -match "https://") {
        $created += $issueUrl
        $projectOk = $false
        gh project item-add $ProjectNumber --owner $Owner --url $issueUrl 2>$null
        if ($LASTEXITCODE -eq 0) { $projectOk = $true }
        if ($projectOk) {
            Write-Host "Created and added: $issueUrl"
        } else {
            Write-Host "Created (not on project — run add-issues-to-project.ps1): $issueUrl"
        }
    } else {
        Write-Warning "Failed: $($task.Title) -> $issueUrl"
    }
}

Write-Host "`nDone. $($created.Count) issues created and added to project $ProjectNumber."
$created | ForEach-Object { Write-Host $_ }
