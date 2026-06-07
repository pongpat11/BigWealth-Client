import * as icons from 'lucide-react'
import type { LucideProps } from 'lucide-react'

/**
 * Resolve a lucide icon by its string name (used by category data).
 * Falls back to a circle if the name is unknown.
 */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp =
    (icons as unknown as Record<string, React.ComponentType<LucideProps>>)[
      name
    ] ?? icons.Circle
  return <Cmp {...props} />
}
