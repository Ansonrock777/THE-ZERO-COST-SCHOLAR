import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FormattedAnswer, { stripMarkdown } from './FormattedAnswer'

afterEach(cleanup)

describe('FormattedAnswer citations', () => {
  it('renders a Unicode-whitespace source marker as a badge', () => {
    render(<FormattedAnswer text={'Answer [Source\u202f2]'} />)

    expect(screen.getByText('2', { selector: 'sup' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('[Source\u202f2]')
  })

  it('strips a non-breaking-space source marker from previews', () => {
    expect(stripMarkdown('Answer [Source\u00a02]')).toBe('Answer')
  })

  it('preserves bracketed citations as badges and strips them from previews', () => {
    render(<FormattedAnswer text='Answer 【3】' />)

    expect(screen.getByText('3', { selector: 'sup' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('【3】')
    expect(stripMarkdown('Answer 【3】')).toBe('Answer')
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
