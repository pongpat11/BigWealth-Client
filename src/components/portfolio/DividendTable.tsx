import { Card, CardBody } from '@/components/ui/Card'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { formatDate } from '@/lib/format'
import { t } from '@/lib/i18n'
import type { Dividend } from '@/lib/portfolio'
import { native } from './format'

function DividendRow({
  dividend,
  onEdit,
  onDelete,
}: {
  dividend: Dividend
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <tr className="border-t border-[var(--color-line)]">
      <th scope="row" className="py-1 pr-2 text-left font-normal">
        {/* The symbol and date open the editor; the rest of the row stays plain figures. */}
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('Edit {name} dividend', { name: dividend.symbol })}
          className="-mx-1 block rounded-lg px-1 py-2 text-left transition-colors hover:bg-[var(--color-canvas)]"
        >
          <span className="block text-sm font-semibold text-[var(--color-ink)]">
            {dividend.symbol}
            {dividend.currency !== 'THB' && (
              <span className="ml-1.5 rounded-full bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                {dividend.currency}
              </span>
            )}
          </span>
          <span className="text-xs text-[var(--color-muted)]">{formatDate(dividend.payDate)}</span>
        </button>
      </th>
      <td className="tnum whitespace-nowrap px-2 text-right text-xs text-[var(--color-muted)]">
        {native(dividend.gross, dividend.currency)}
      </td>
      <td className="tnum whitespace-nowrap px-2 text-right text-xs text-[var(--color-loss)]">
        {dividend.withholdingTax > 0 ? `−${native(dividend.withholdingTax, dividend.currency)}` : '—'}
      </td>
      <td className="tnum whitespace-nowrap pl-2 text-right text-sm font-semibold text-[var(--color-gain)]">
        {native(dividend.net, dividend.currency)}
      </td>
      <td className="w-10 pl-1 text-right">
        <DeleteButton
          label={t('Delete {name} dividend', { name: dividend.symbol })}
          onClick={onDelete}
          className="ml-auto"
        />
      </td>
    </tr>
  )
}

/** Dividends with gross, tax and net in their own currency. Tap a row's symbol to edit it. */
export function DividendTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Dividend[]
  onEdit: (d: Dividend) => void
  onDelete: (d: Dividend) => void
}) {
  return (
    <Card>
      <CardBody className="overflow-x-auto py-1">
        <table className="w-full">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              <th scope="col" className="py-2 pr-2 text-left font-semibold">
                {t('Dividend')}
              </th>
              <th scope="col" className="px-2 text-right font-semibold">
                {t('Gross')}
              </th>
              <th scope="col" className="px-2 text-right font-semibold">
                {t('Tax')}
              </th>
              <th scope="col" className="pl-2 text-right font-semibold">
                {t('Net')}
              </th>
              <th scope="col">
                <span className="sr-only">{t('Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <DividendRow key={d.id} dividend={d} onEdit={() => onEdit(d)} onDelete={() => onDelete(d)} />
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  )
}
