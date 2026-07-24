import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/apiClient', () => ({
  default: { post: vi.fn() },
}))

import api from '../../lib/apiClient'
import QueryPanel, { createQueryPayload } from './QueryPanel'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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

describe('QueryPanel initialTurn', () => {
  it('seeds the thread from a replayed history entry', () => {
    render(
      <QueryPanel
        document={{ document_id: 'doc-1', filename: 'guide.pdf' }}
        initialTurn={{
          question: 'What is retrieval?',
          answer: 'Retrieval finds relevant chunks.',
          sources: [{ page: 2, score: 0.2, text: 'Retrieval excerpt' }],
        }}
      />,
    )

    expect(screen.getByText('What is retrieval?')).toBeInTheDocument()
    expect(screen.getByText('Retrieval finds relevant chunks.')).toBeInTheDocument()
    expect(screen.getByText('Retrieval excerpt')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('forwards onCitationClick to the sources list', () => {
    const onCitationClick = vi.fn()
    render(
      <QueryPanel
        document={{ document_id: 'doc-1', filename: 'guide.pdf' }}
        initialTurn={{
          question: 'Q',
          answer: 'A',
          sources: [{ page: 5, score: 0.1, text: 'Clickable source' }],
        }}
        onCitationClick={onCitationClick}
      />,
    )

    fireEvent.click(screen.getByText('Clickable source'))
    expect(onCitationClick).toHaveBeenCalledWith({ page: 5, score: 0.1, text: 'Clickable source' }, 0)
  })
})
