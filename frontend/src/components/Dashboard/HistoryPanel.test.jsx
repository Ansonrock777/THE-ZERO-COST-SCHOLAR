import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/apiClient', () => ({
  default: { get: vi.fn() },
}))

import api from '../../lib/apiClient'
import HistoryPanel, { groupLogsByDate } from './HistoryPanel'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('groupLogsByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T15:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups logs into Today/Yesterday/older buckets, preserving newest-first order', () => {
    const logs = [
      { id: '1', created_at: '2026-07-23T09:00:00', question: 'today q1' },
      { id: '2', created_at: '2026-07-23T08:00:00', question: 'today q2' },
      { id: '3', created_at: '2026-07-22T10:00:00', question: 'yesterday q' },
      { id: '4', created_at: '2026-07-20T10:00:00', question: 'older q' },
    ]

    const groups = groupLogsByDate(logs)
    const expectedOlderLabel = new Date('2026-07-20T10:00:00').toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    })

    expect(groups.map(g => g.label)).toEqual(['Today', 'Yesterday', expectedOlderLabel])
    expect(groups[0].logs).toHaveLength(2)
    expect(groups[1].logs).toHaveLength(1)
    expect(groups[2].logs).toHaveLength(1)
  })

  it('returns an empty array for no logs', () => {
    expect(groupLogsByDate([])).toEqual([])
  })
})

describe('HistoryPanel', () => {
  it('shows a loading state, then the fetched entries grouped by date', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: '1', question: 'What is BM25?', answer: 'A ranking function.', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } },
      ],
    })

    render(<HistoryPanel />)

    expect(screen.getByText('Loading history...')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('What is BM25?')).toBeInTheDocument())
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('shows an error message on failure', async () => {
    api.get.mockRejectedValue({ message: 'Network Error' })

    render(<HistoryPanel />)

    await waitFor(() => expect(screen.getByText(/Failed to load history/)).toBeInTheDocument())
  })

  it('shows an empty state with no logs', async () => {
    api.get.mockResolvedValue({ data: [] })

    render(<HistoryPanel />)

    await waitFor(() => expect(screen.getByText('No queries yet.')).toBeInTheDocument())
  })

  it('filters entries by search term', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: '1', question: 'What is BM25?', answer: '', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } },
        { id: '2', question: 'Compare precision and recall', answer: '', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } },
      ],
    })

    render(<HistoryPanel searchTerm='precision' />)

    await waitFor(() => expect(screen.getByText('Compare precision and recall')).toBeInTheDocument())
    expect(screen.queryByText('What is BM25?')).not.toBeInTheDocument()
  })

  it('shows a no-matches message when the search filters everything out', async () => {
    api.get.mockResolvedValue({
      data: [{ id: '1', question: 'What is BM25?', answer: '', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } }],
    })

    render(<HistoryPanel searchTerm='nonexistent' />)

    await waitFor(() => expect(screen.getByText('No matching inquiries.')).toBeInTheDocument())
  })

  it('calls onSelectHistory with the clicked log', async () => {
    const onSelectHistory = vi.fn()
    const log = { id: '1', question: 'What is BM25?', answer: 'A ranking function.', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } }
    api.get.mockResolvedValue({ data: [log] })

    render(<HistoryPanel onSelectHistory={onSelectHistory} />)

    await waitFor(() => expect(screen.getByText('What is BM25?')).toBeInTheDocument())
    fireEvent.click(screen.getByText('What is BM25?'))

    expect(onSelectHistory).toHaveBeenCalledWith(log)
  })
})
