import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNavLayout, resetNavCache } from '@/lib/nav'
import { More } from '@/pages/More'
import { AppShell } from './AppShell'

vi.mock('@/lib/recurring', () => ({ runRecurring: () => Promise.resolve(0) }))

function renderApp(path = '/more') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>home</div>} />
          <Route path="/more" element={<More />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

/** Labels of the mobile tab bar (the last <nav>), in order. */
function tabBar() {
  const navs = screen.getAllByRole('navigation', { name: 'Primary' })
  return within(navs[navs.length - 1])
    .getAllByRole('link')
    .map((a) => a.textContent)
}

async function openSheet() {
  await userEvent.click(screen.getByRole('button', { name: 'Customize tab bar' }))
  return within(screen.getByRole('dialog', { name: 'Customize tab bar' }))
}

describe('Customize tab bar', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNavCache()
  })

  it('swaps a tab for a More screen and saves', async () => {
    renderApp()
    expect(tabBar()).toEqual(['Home', 'Transactions', 'Portfolio', 'Budgets', 'More'])

    const sheet = await openSheet()
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Portfolio from the tab bar' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Add Goals to the tab bar' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(tabBar()).toEqual(['Home', 'Transactions', 'Budgets', 'Goals', 'More'])
    // Portfolio went to the top of the More list.
    const morePage = screen.getAllByRole('link').filter((a) => a.closest('main'))
    expect(morePage[0]).toHaveTextContent('Portfolio')
    expect(getNavLayout().tabs).toEqual(['/', '/transactions', '/budgets', '/goals'])
  })

  it('explains the limits instead of breaking them', async () => {
    renderApp()
    const sheet = await openSheet()
    await userEvent.click(sheet.getByRole('button', { name: 'Add Goals to the tab bar' }))
    expect(sheet.getByRole('status')).toHaveTextContent('Tab bar is full')

    await userEvent.click(sheet.getByRole('button', { name: 'Remove Home from the tab bar' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Transactions from the tab bar' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Portfolio from the tab bar' }))
    expect(sheet.getByRole('status')).toHaveTextContent('Keep at least 2 tabs')
    expect(sheet.getByText('2 / 4')).toBeInTheDocument()
  })

  it('reorders with the keyboard', async () => {
    renderApp()
    const sheet = await openSheet()
    const handle = sheet.getByRole('button', { name: 'Move Budgets' })
    handle.focus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    await userEvent.keyboard(' ')
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    expect(tabBar()).toEqual(['Budgets', 'Home', 'Transactions', 'Portfolio', 'More'])
  })

  it('cancel discards changes; reset restores the default', async () => {
    renderApp()
    let sheet = await openSheet()
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Home from the tab bar' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Cancel' }))
    expect(tabBar()[0]).toBe('Home')

    sheet = await openSheet()
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Home from the tab bar' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    expect(tabBar()[0]).toBe('Transactions')

    sheet = await openSheet()
    await userEvent.click(sheet.getByRole('button', { name: 'Reset to default' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    expect(tabBar()).toEqual(['Home', 'Transactions', 'Portfolio', 'Budgets', 'More'])
    expect(localStorage.getItem('bw.nav.v1')).toBeNull()
  })

  it('opens on a long press of the tab bar', () => {
    vi.useFakeTimers()
    try {
      renderApp('/')
      const navs = screen.getAllByRole('navigation', { name: 'Primary' })
      const bar = navs[navs.length - 1]
      fireEvent.pointerDown(bar, { button: 0, clientX: 10, clientY: 10 })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(screen.getByRole('dialog', { name: 'Customize tab bar' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
