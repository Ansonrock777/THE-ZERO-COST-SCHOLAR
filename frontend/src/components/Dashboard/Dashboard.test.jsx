import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '../../lib/apiClient'
import Dashboard from './Dashboard'

vi.mock('../../lib/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'student@example.com' } }),
}))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

vi.mock('./UploadPanel', () => ({
  default: ({ onUploadComplete }) => (
    <button
      type='button'
      onClick={() => onUploadComplete({
        document_id: 'doc-3',
        filename: 'just-uploaded.pdf',
        chunk_count: 4,
        page_count: 2,
      })}
    >
      Complete upload
    </button>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Dashboard', () => {
  it('selects the newest saved document and selects a completed upload', async () => {
    api.get.mockImplementation(path => {
      if (path === '/documents') {
        return Promise.resolve({
          data: [
            { id: 'doc-2', filename: 'newest.pdf' },
            { id: 'doc-1', filename: 'older.pdf' },
          ],
        })
      }
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })

    render(<Dashboard />)

    const selector = await screen.findByLabelText('Document')
    expect(selector).toHaveValue('doc-2')
    expect(api.get).toHaveBeenCalledWith('/documents')

    fireEvent.click(screen.getByRole('button', { name: 'Complete upload' }))

    await waitFor(() => expect(selector).toHaveValue('doc-3'))
    expect(screen.getByRole('option', { name: 'just-uploaded.pdf' })).toBeInTheDocument()
  })

  it('keeps a completed upload selected when the initial document request resolves late', async () => {
    let resolveDocuments
    const documentsRequest = new Promise(resolve => { resolveDocuments = resolve })

    api.get.mockImplementation(path => {
      if (path === '/documents') return documentsRequest
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })

    render(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: 'Complete upload' }))
    resolveDocuments({ data: [{ id: 'doc-2', filename: 'saved-before-upload.pdf' }] })

    const selector = await screen.findByLabelText('Document')
    expect(selector).toHaveValue('doc-3')
    expect(screen.getByRole('option', { name: 'just-uploaded.pdf' })).toBeInTheDocument()
  })

  it('clears a completed answer and its sources when switching documents', async () => {
    api.get.mockImplementation(path => {
      if (path === '/documents') {
        return Promise.resolve({ data: [
          { id: 'doc-a', filename: 'alpha.pdf' },
          { id: 'doc-b', filename: 'bravo.pdf' },
        ] })
      }
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
    api.post.mockResolvedValue({ data: {
      answer: 'Answer from alpha',
      sources: [{ page: 1, score: 0.1, text: 'Alpha source excerpt' }],
    } })

    render(<Dashboard />)

    const selector = await screen.findByLabelText('Document')
    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'Question about alpha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    await screen.findByText('Answer from alpha')
    expect(screen.getByText('Alpha source excerpt')).toBeInTheDocument()

    fireEvent.change(selector, { target: { value: 'doc-b' } })

    expect(screen.getByText('Document: bravo.pdf')).toBeInTheDocument()
    expect(screen.queryByText('Answer from alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Alpha source excerpt')).not.toBeInTheDocument()
  })

  it('does not show a late answer from the previously selected document', async () => {
    let resolveQuery
    const queryRequest = new Promise(resolve => { resolveQuery = resolve })

    api.get.mockImplementation(path => {
      if (path === '/documents') {
        return Promise.resolve({ data: [
          { id: 'doc-a', filename: 'alpha.pdf' },
          { id: 'doc-b', filename: 'bravo.pdf' },
        ] })
      }
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
    api.post.mockReturnValue(queryRequest)

    render(<Dashboard />)

    const selector = await screen.findByLabelText('Document')
    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'Question about alpha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(() => expect(screen.getAllByText('Thinking...')).toHaveLength(2))

    fireEvent.change(selector, { target: { value: 'doc-b' } })
    await act(async () => {
      resolveQuery({ data: {
        answer: 'Late alpha answer',
        sources: [{ page: 1, score: 0.1, text: 'Late alpha source' }],
      } })
      await queryRequest
    })

    expect(screen.getByText('Document: bravo.pdf')).toBeInTheDocument()
    expect(screen.queryByText('Late alpha answer')).not.toBeInTheDocument()
    expect(screen.queryByText('Late alpha source')).not.toBeInTheDocument()
  })
})
