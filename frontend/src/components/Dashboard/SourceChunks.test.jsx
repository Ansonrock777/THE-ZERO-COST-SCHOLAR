import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
