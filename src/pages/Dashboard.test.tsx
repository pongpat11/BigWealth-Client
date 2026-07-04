import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Dashboard } from './Dashboard'
import { netWorthHistory } from '@/data/mock'
import { formatTHB } from '@/lib/format'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('shows the net worth hero with the latest figure', () => {
    renderDashboard()
    expect(screen.getByText(/net worth/i)).toBeInTheDocument()
    const latest = netWorthHistory[netWorthHistory.length - 1].value
    expect(screen.getByText(formatTHB(latest))).toBeInTheDocument()
  })

  it('shows assets and debts stat cards', () => {
    renderDashboard()
    expect(screen.getByText(/assets/i)).toBeInTheDocument()
    expect(screen.getByText(/debts/i)).toBeInTheDocument()
  })

  it('shows the asset allocation legend', () => {
    renderDashboard()
    expect(screen.getByText('Asset allocation')).toBeInTheDocument()
    expect(screen.getByText('Thai Stocks')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })

  it('lists recent transactions with a link to see all', () => {
    renderDashboard()
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('Lunch — som tam')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see all/i })).toHaveAttribute(
      'href',
      '/transactions',
    )
  })
})
