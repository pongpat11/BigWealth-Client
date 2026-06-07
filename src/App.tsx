import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// Placeholder shell while the UI is being designed in Figma.
// Screens get built from docs/DESIGN_SPEC.md once the frames are ready.
function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl font-bold text-white shadow-[var(--shadow-card)]">
        ฿
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          BigWealth
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Money management &amp; multi-asset portfolio tracker
        </p>
      </div>
      <Card className="w-full text-left">
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="gain">Scaffolded</Badge>
            <Badge tone="neutral">Design phase</Badge>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            Foundation is ready: Vite + React + TS, Tailwind v4 tokens, router
            &amp; chart libs installed, mock data and base components in place.
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            UI is being designed in Figma from{' '}
            <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs">
              docs/DESIGN_SPEC.md
            </code>
            . Screens get built next.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

export default App
