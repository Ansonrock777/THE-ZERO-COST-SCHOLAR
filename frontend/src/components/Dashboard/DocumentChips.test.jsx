import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentChips from './DocumentChips'

afterEach(cleanup)

describe('DocumentChips', () => {
  it('renders nothing when there are no documents', () => {
    const { container } = render(<DocumentChips documents={[]} selectedId='' onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a chip per document and marks the selected one', () => {
    render(
      <DocumentChips
        documents={[
          { document_id: 'doc-1', filename: 'alpha.pdf' },
          { document_id: 'doc-2', filename: 'bravo.pdf' },
        ]}
        selectedId='doc-2'
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'alpha.pdf' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'bravo.pdf' })).toHaveAttribute('aria-current', 'true')
  })

  it('emits the chosen document ID on click', () => {
    const onChange = vi.fn()
    render(
      <DocumentChips
        documents={[
          { document_id: 'doc-1', filename: 'alpha.pdf' },
          { document_id: 'doc-2', filename: 'bravo.pdf' },
        ]}
        selectedId='doc-1'
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'bravo.pdf' }))

    expect(onChange).toHaveBeenCalledWith('doc-2')
  })
})
