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
})
