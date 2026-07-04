import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

function renderShell(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>dashboard-content</div>} />
          <Route path="/budgets" element={<div>budgets-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('renders the outlet content', () => {
    renderShell()
    expect(screen.getByText('dashboard-content')).toBeInTheDocument()
  })

  it('renders primary navigation (sidebar + mobile tab bar)', () => {
    renderShell()
    for (const label of ['Home', 'Transactions', 'Portfolio', 'Budgets']) {
      // Appears in both the sidebar and the bottom tab bar
      expect(
        screen.getAllByRole('link', { name: new RegExp(label, 'i') }).length,
      ).toBeGreaterThanOrEqual(1)
    }
    expect(screen.getAllByRole('link', { name: /more/i }).length).toBe(1)
  })

  it('renders secondary navigation in the sidebar', () => {
    renderShell()
    for (const label of ['Goals', 'Debts', 'Reports', 'Accounts', 'Settings']) {
      expect(
        screen.getAllByRole('link', { name: new RegExp(label, 'i') }).length,
      ).toBe(1)
    }
  })

  it('routes between pages', () => {
    renderShell('/budgets')
    expect(screen.getByText('budgets-content')).toBeInTheDocument()
  })
})
