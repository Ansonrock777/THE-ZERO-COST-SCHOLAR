import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FormattedAnswer, { stripMarkdown } from './FormattedAnswer'

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
