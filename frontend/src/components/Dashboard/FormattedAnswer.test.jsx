<<<<<<< HEAD
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
=======
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
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

  it('opens the source attached to a citation', () => {
    const onCitationClick = vi.fn()
    const source = { filename: 'paper.pdf', page: 4 }
    render(<FormattedAnswer text='Evidence [Source 1]' sources={[source]} onCitationClick={onCitationClick} />)
    fireEvent.click(screen.getByRole('button', { name: /open citation 1/i }))
    expect(onCitationClick).toHaveBeenCalledWith(source)
  })
})

describe('FormattedAnswer clickable citations', () => {
  it('makes a citation badge clickable when its source has a known page', () => {
    const onCitationClick = vi.fn()
    const sources = [{ page: 2, score: 0.1, text: 'Cited text' }]

    render(<FormattedAnswer text='Answer [Source 1]' sources={sources} onCitationClick={onCitationClick} />)

    const badge = screen.getByText('1', { selector: 'sup' })
    expect(badge).toHaveAttribute('role', 'button')

    fireEvent.click(badge)
    expect(onCitationClick).toHaveBeenCalledWith(sources[0], 0)
  })

  it('leaves the badge non-interactive when the source has no known page', () => {
    const onCitationClick = vi.fn()
    const sources = [{ page: '?', score: null, text: 'Unknown page source' }]

    render(<FormattedAnswer text='Answer [Source 1]' sources={sources} onCitationClick={onCitationClick} />)

    const badge = screen.getByText('1', { selector: 'sup' })
    expect(badge).not.toHaveAttribute('role')

    fireEvent.click(badge)
    expect(onCitationClick).not.toHaveBeenCalled()
  })

  it('stays non-interactive with no sources provided (backward compatible)', () => {
    render(<FormattedAnswer text='Answer [Source 1]' />)

    const badge = screen.getByText('1', { selector: 'sup' })
    expect(badge).not.toHaveAttribute('role')
  })
})
