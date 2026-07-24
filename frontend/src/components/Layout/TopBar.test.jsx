import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TopBar from './TopBar'

afterEach(cleanup)

describe('TopBar', () => {
  it('renders the title and status', () => {
    render(
      <TopBar
        title='Ask about guide.pdf'
        status='Searching your PDFs...'
        email='student@example.com'
        theme='light'
        onToggleTheme={vi.fn()}
        onSignOut={vi.fn()}
        onOpenSidebar={vi.fn()}
      />,
    )

    expect(screen.getByText('Ask about guide.pdf')).toBeInTheDocument()
    expect(screen.getByText('Searching your PDFs...')).toBeInTheDocument()
  })

  it('toggles theme only when switching to the other option', () => {
    const onToggleTheme = vi.fn()
    render(
      <TopBar
        title='Ask'
        email='student@example.com'
        theme='light'
        onToggleTheme={onToggleTheme}
        onSignOut={vi.fn()}
        onOpenSidebar={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /light/i }))
    expect(onToggleTheme).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /dark/i }))
    expect(onToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('opens the user menu and signs out', () => {
    const onSignOut = vi.fn()
    render(
      <TopBar
        title='Ask'
        email='student@example.com'
        theme='light'
        onToggleTheme={vi.fn()}
        onSignOut={onSignOut}
        onOpenSidebar={vi.fn()}
      />,
    )

    expect(screen.queryByText('student@example.com')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('student@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('opens the sidebar drawer', () => {
    const onOpenSidebar = vi.fn()
    render(
      <TopBar
        title='Ask'
        email='student@example.com'
        theme='light'
        onToggleTheme={vi.fn()}
        onSignOut={vi.fn()}
        onOpenSidebar={onOpenSidebar}
      />,
    )

    fireEvent.click(screen.getByLabelText('Open sidebar'))
    expect(onOpenSidebar).toHaveBeenCalledTimes(1)
  })
})
