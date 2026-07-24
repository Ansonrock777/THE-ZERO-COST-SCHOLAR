import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PdfHighlightOverlay from './PdfHighlightOverlay'

describe('PdfHighlightOverlay', () => {
  it('renders nothing when there are no rects', () => {
    const { container } = render(<PdfHighlightOverlay rects={[]} label={1} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a highlight box per rect and the numbered badge', () => {
    const rects = [
      { top: 100, left: 50, width: 80, height: 14 },
      { top: 118, left: 50, width: 60, height: 14 },
    ]

    const { container } = render(<PdfHighlightOverlay rects={rects} label={2} />)

    expect(container.querySelectorAll('.bg-highlight-bg\\/60')).toHaveLength(2)
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
