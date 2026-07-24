import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FormattedAnswer, { stripMarkdown } from './FormattedAnswer'

describe('FormattedAnswer citations', () => {
  it('renders Unicode-whitespace source markers as controls', () => {
    render(<FormattedAnswer text={'Answer [Source\u202f2]'} />)
    expect(screen.getByRole('button', { name: /open citation 2/i })).toBeInTheDocument()
    expect(stripMarkdown('Answer [Source\u00a02]')).toBe('Answer')
  })

  it('supports bracketed citations', () => {
    render(<FormattedAnswer text='Answer 【3】' />)
    expect(screen.getByRole('button', { name: /open citation 3/i })).toBeInTheDocument()
    expect(stripMarkdown('Answer 【3】')).toBe('Answer')
  })

  it('opens the source attached to a citation', () => {
    const onCitationClick = vi.fn()
    const source = { filename: 'paper.pdf', page: 4 }
    render(<FormattedAnswer text='Evidence [Source 1]' sources={[source]} onCitationClick={onCitationClick} />)
    fireEvent.click(screen.getByRole('button', { name: /open citation 1/i }))
    expect(onCitationClick).toHaveBeenCalledWith(source)
  })
})
