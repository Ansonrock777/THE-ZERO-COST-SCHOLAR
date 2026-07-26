import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell'

const documents = [
  { document_id: 'doc-a', filename: 'Archive notes.pdf' },
  { document_id: 'doc-b', filename: 'Research handbook.pdf' },
]

afterEach(cleanup)

describe('AppShell', () => {
  it('supports multiple document selection and mobile pane switching', () => {
    const onToggleDocument = vi.fn()
    render(
      <AppShell
        documents={documents}
        conversations={[]}
        selectedDocumentIds={['doc-a']}
        activeDocument={documents[0]}
        mobilePane='chat'
        theme='light'
        onToggleDocument={onToggleDocument}
        onMobilePaneChange={vi.fn()}
        onThemeChange={vi.fn()}
      >
        <div>Chat workspace</div>
        <div>PDF workspace</div>
      </AppShell>,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /research handbook/i }))
    expect(onToggleDocument).toHaveBeenCalledWith('doc-b')
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('The Zero-Cost Scholar')).toBeInTheDocument()
  })

  it('provides theme and collapsible navigation controls', () => {
    const onThemeChange = vi.fn()
    render(
      <AppShell
        documents={documents}
        conversations={[]}
        selectedDocumentIds={[]}
        activeDocument={null}
        mobilePane='chat'
        theme='dark'
        onToggleDocument={vi.fn()}
        onMobilePaneChange={vi.fn()}
        onThemeChange={onThemeChange}
      >
        <div>Chat</div><div>PDF</div>
      </AppShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }))
    expect(onThemeChange).toHaveBeenCalledWith('light')
    fireEvent.click(screen.getByRole('button', { name: /collapse navigation/i }))
    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true')
    const separator = screen.getByRole('separator', { name: /resize/i })
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(separator.parentElement.style.getPropertyValue('--chat-width')).toBe('44%')
  })
})
