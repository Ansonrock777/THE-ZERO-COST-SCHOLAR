import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DocumentSelector from './DocumentSelector'

describe('DocumentSelector', () => {
  it('labels the native document selector and emits the chosen document ID', () => {
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

    const selector = screen.getByLabelText('Document')
    fireEvent.change(selector, { target: { value: 'doc-2' } })

    expect(onChange).toHaveBeenCalledWith('doc-2')
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
})
