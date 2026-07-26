import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentSelector from './DocumentSelector'

afterEach(cleanup)

describe('DocumentSelector', () => {
  it('lists documents and emits the chosen document ID on click', () => {
    const onChange = vi.fn()

    render(
      <DocumentSelector
        documents={[
          { document_id: 'doc-1', filename: 'newest.pdf' },
          { document_id: 'doc-2', filename: 'older.pdf' },
        ]}
        selectedId='doc-1'
        onChange={onChange}
        loading={false}
        error=''
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'older.pdf' }))

    expect(onChange).toHaveBeenCalledWith('doc-2')
  })

  it('marks the currently selected document', () => {
    render(
      <DocumentSelector
        documents={[
          { document_id: 'doc-1', filename: 'newest.pdf' },
          { document_id: 'doc-2', filename: 'older.pdf' },
        ]}
        selectedId='doc-1'
        onChange={vi.fn()}
        loading={false}
        error=''
      />,
    )

    expect(screen.getByRole('button', { name: 'newest.pdf' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'older.pdf' })).not.toHaveAttribute('aria-current')
  })

  it('announces when saved documents are loading', () => {
    render(<DocumentSelector documents={[]} selectedId='' onChange={vi.fn()} loading error='' />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading documents...')
  })

  it('alerts the user when saved documents cannot load', () => {
    render(<DocumentSelector documents={[]} selectedId='' onChange={vi.fn()} loading={false} error='Unable to load documents.' />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load documents.')
  })

  it('directs the user to upload when there are no saved documents', () => {
    render(<DocumentSelector documents={[]} selectedId='' onChange={vi.fn()} loading={false} error='' />)

    expect(screen.getByText('No uploaded documents yet.')).toBeInTheDocument()
  })

  it('calls onDelete with the document, without also selecting it', () => {
    const onChange = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentSelector
        documents={[{ document_id: 'doc-1', filename: 'newest.pdf' }]}
        selectedId=''
        onChange={onChange}
        loading={false}
        error=''
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete newest.pdf' }))

    expect(onDelete).toHaveBeenCalledWith({ document_id: 'doc-1', filename: 'newest.pdf' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
