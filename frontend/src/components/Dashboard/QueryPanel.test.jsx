import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/apiClient', () => ({
  default: { post: vi.fn() },
}))

import api from '../../lib/apiClient'
import QueryPanel, { createQueryPayload } from './QueryPanel'

describe('createQueryPayload', () => {
  it('sends only the question and selected document ID', () => {
    expect(createQueryPayload('Question?', {
      document_id: 'doc-1',
      collection_name: 'must-not-leak',
    })).toEqual({ question: 'Question?', document_id: 'doc-1' })
  })

  it('submits only the question and document ID', async () => {
    api.post.mockResolvedValue({ data: { answer: '', sources: [] } })

    render(<QueryPanel document={{ document_id: 'doc-1', filename: 'guide.pdf' }} />)

    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'Question?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/query', {
      question: 'Question?',
      document_id: 'doc-1',
    }))
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('collection_name')
  })
})
