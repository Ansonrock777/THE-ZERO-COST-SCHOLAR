import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SourceChunks from './SourceChunks'

describe('SourceChunks score labels', () => {
  it('labels a null score as adjacent context', () => {
    render(<SourceChunks sources={[{ page: 1, score: null, text: 'Context chunk' }]} />)

    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(screen.getByText('adjacent context')).toBeInTheDocument()
  })

  it('labels a numeric score as a Chroma distance', () => {
    render(<SourceChunks sources={[{ page: 1, score: 0.25, text: 'Retrieved chunk' }]} />)

    expect(screen.getByText('distance 0.25')).toBeInTheDocument()
  })
})

describe('SourceChunks citation clicks', () => {
  it('calls onCitationClick with the source and index when a known-page source is clicked', () => {
    const onCitationClick = vi.fn()
    const source = { page: 4, score: 0.1, text: 'Cited passage' }
    render(<SourceChunks sources={[source]} onCitationClick={onCitationClick} />)

    fireEvent.click(screen.getByText('Cited passage'))

    expect(onCitationClick).toHaveBeenCalledWith(source, 0)
  })

  it('disables the citation when the source has no known page', () => {
    const onCitationClick = vi.fn()
    render(<SourceChunks sources={[{ page: '?', score: null, text: 'Unknown page' }]} onCitationClick={onCitationClick} />)

    expect(screen.getByText('Unknown page').closest('button')).toBeDisabled()
  })
})
