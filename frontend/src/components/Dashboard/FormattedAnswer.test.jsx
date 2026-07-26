import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FormattedAnswer, { stripMarkdown } from './FormattedAnswer'

afterEach(cleanup)

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

  it('renders full Unicode source labels as clickable citations', () => {
    render(<FormattedAnswer text='Answer 【Source 3】' />)
    expect(screen.getByRole('button', { name: /open citation 3/i })).toBeInTheDocument()
  })

  it('opens the source attached to a citation', () => {
    const onCitationClick = vi.fn()
    const source = { filename: 'paper.pdf', page: 4 }
    render(<FormattedAnswer text='Evidence [Source 1]' sources={[source]} onCitationClick={onCitationClick} />)
    fireEvent.click(screen.getByRole('button', { name: /open citation 1/i }))
    expect(onCitationClick).toHaveBeenCalledWith(source)
  })
})

describe('FormattedAnswer clickable citations', () => {
  it('renders the citation badge as a button inside a sup marker', () => {
    const onCitationClick = vi.fn()
    const sources = [{ page: 2, score: 0.1, text: 'Cited text' }]

    render(<FormattedAnswer text='Answer [Source 1]' sources={sources} onCitationClick={onCitationClick} />)

    const badge = screen.getByRole('button', { name: 'Open citation 1' })
    expect(badge.closest('sup')).toHaveClass('citation-marker')

    fireEvent.click(badge)
    expect(onCitationClick).toHaveBeenCalledWith(sources[0])
  })

  it('names the badge after the cited file when one is known', () => {
    const sources = [{ filename: 'paper.pdf', page: 2, text: 'Cited text' }]

    render(<FormattedAnswer text='Answer [Source 1]' sources={sources} />)

    expect(screen.getByRole('button', { name: 'Open citation 1 in paper.pdf' })).toBeInTheDocument()
  })

  it('still renders a badge when no sources are provided (backward compatible)', () => {
    const onCitationClick = vi.fn()

    render(<FormattedAnswer text='Answer [Source 1]' onCitationClick={onCitationClick} />)

    const badge = screen.getByRole('button', { name: 'Open citation 1' })
    fireEvent.click(badge)
    expect(onCitationClick).toHaveBeenCalledWith(undefined)
  })

  it('lists sources as footnotes when citationPlacement is footnotes', () => {
    const onCitationClick = vi.fn()
    const sources = [{ document_id: 'doc-a', chunk_index: 0, filename: 'paper.pdf', page: 4 }]

    render(<FormattedAnswer text='Answer [Source 1]' sources={sources} citationPlacement='footnotes' onCitationClick={onCitationClick} />)

    fireEvent.click(screen.getByRole('button', { name: 'paper.pdf, page 4' }))
    expect(onCitationClick).toHaveBeenCalledWith(sources[0])
  })
})
