import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/queryStream', () => ({ streamQuery: vi.fn(async (payload, { onEvent }) => { onEvent({ type: 'status', stage: 'retrieving' }); onEvent({ type: 'result', answer: 'Grounded [Source 1]', sources: [{ filename: 'guide.pdf', page: 2 }] }) }) }))
import { streamQuery } from '../../lib/queryStream'
import ChatPane from './ChatPane'

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ChatPane', () => {
  it('clears selected text when the dismiss button is activated', () => {
    const clearSelectedText = vi.fn()
    render(<ChatPane documentIds={['doc-1']} selectedPdfText='chosen evidence' onClearSelectedText={clearSelectedText} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear selected text' }))

    expect(clearSelectedText).toHaveBeenCalledTimes(1)
  })

  it('creates a conversation, includes selected text, and renders the result', async () => {
    const ensure = vi.fn().mockResolvedValue('conversation-1')
    render(<ChatPane documentIds={['doc-1']} selectedPdfText='chosen evidence' onEnsureConversation={ensure} />)
    fireEvent.change(screen.getByLabelText('Ask a question'), { target: { value: 'What does it mean?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('Grounded')).toBeInTheDocument()
    expect(ensure).toHaveBeenCalledWith('What does it mean?')
    expect(streamQuery.mock.calls[0][0]).toMatchObject({ document_ids: ['doc-1'], conversation_id: 'conversation-1' })
    expect(streamQuery.mock.calls[0][0].question).toContain('chosen evidence')
  })

  it('offers retry after a completed answer', async () => {
    render(<ChatPane documentIds={['doc-1']} conversationId='conversation-1' />)
    fireEvent.change(screen.getByLabelText('Ask a question'), { target: { value: 'Question' } })
    fireEvent.submit(screen.getByLabelText('Ask a question').closest('form'))
    await screen.findByText('Grounded')
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(streamQuery).toHaveBeenCalledTimes(2))
  })
})
