import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '../../lib/apiClient'
import Dashboard from './Dashboard'

vi.mock('../../lib/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
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

// Real pdf.js rendering needs no fixture/network here — only Dashboard's own
// wiring (which document/citation it hands down) is under test.
vi.mock('./PdfViewerPane', () => ({
  default: ({ selectedDocument, activeCitation }) => (
    <div data-testid='mock-pdf-pane'>
      <span>{selectedDocument ? `pdf:${selectedDocument.filename}` : 'pdf:none'}</span>
      {activeCitation && <span>{`citation-page:${activeCitation.page}`}</span>}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const chips = () => within(screen.getByRole('group', { name: 'Document chips' }))

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

    await waitFor(() => expect(chips().getByRole('button', { name: 'newest.pdf' })).toHaveAttribute('aria-current', 'true'))
    expect(api.get).toHaveBeenCalledWith('/documents')

    fireEvent.click(screen.getByRole('button', { name: 'Upload a document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete upload' }))

    await waitFor(() => expect(chips().getByRole('button', { name: 'just-uploaded.pdf' })).toHaveAttribute('aria-current', 'true'))
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

    fireEvent.click(screen.getByRole('button', { name: 'Upload a document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete upload' }))
    resolveDocuments({ data: [{ id: 'doc-2', filename: 'saved-before-upload.pdf' }] })

    await waitFor(() => expect(chips().getByRole('button', { name: 'just-uploaded.pdf' })).toHaveAttribute('aria-current', 'true'))
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

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))
    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'Question about alpha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    await screen.findByText('Answer from alpha')
    expect(screen.getByText('Alpha source excerpt')).toBeInTheDocument()

    fireEvent.click(chips().getByRole('button', { name: 'bravo.pdf' }))

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

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))
    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'Question about alpha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(() => expect(screen.getAllByText('Thinking...')).toHaveLength(2))

    fireEvent.click(chips().getByRole('button', { name: 'bravo.pdf' }))
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

  it('New inquiry clears the current question and answer', async () => {
    api.get.mockImplementation(path => {
      if (path === '/documents') return Promise.resolve({ data: [{ id: 'doc-a', filename: 'alpha.pdf' }] })
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
    api.post.mockResolvedValue({ data: { answer: 'Answer text', sources: [] } })

    render(<Dashboard />)

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))
    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'A question' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByText('Answer text')

    fireEvent.click(screen.getByRole('button', { name: /new inquiry/i }))

    expect(screen.queryByText('Answer text')).not.toBeInTheDocument()
    expect(screen.queryByText('A question')).not.toBeInTheDocument()
  })

  it('loads a history entry into the chat and switches the selected document', async () => {
    const log = {
      id: 'log-1',
      question: 'Old question',
      answer: 'Old answer',
      sources: [{ page: 3, score: 0.1, text: 'Old source' }],
      document_id: 'doc-b',
      created_at: new Date().toISOString(),
      user_documents: { filename: 'bravo.pdf' },
    }
    api.get.mockImplementation(path => {
      if (path === '/documents') {
        return Promise.resolve({ data: [
          { id: 'doc-a', filename: 'alpha.pdf' },
          { id: 'doc-b', filename: 'bravo.pdf' },
        ] })
      }
      if (path === '/history') return Promise.resolve({ data: [log] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })

    render(<Dashboard />)

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))

    fireEvent.click(screen.getByRole('button', { name: /Old question/ }))

    await waitFor(() => expect(chips().getByRole('button', { name: 'bravo.pdf' })).toHaveAttribute('aria-current', 'true'))
    expect(screen.getByText('Old answer')).toBeInTheDocument()
    expect(screen.getByText('Old source')).toBeInTheDocument()
  })

  it('clicking a citation hands its page to the PDF pane', async () => {
    api.get.mockImplementation(path => {
      if (path === '/documents') return Promise.resolve({ data: [{ id: 'doc-a', filename: 'alpha.pdf' }] })
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
    api.post.mockResolvedValue({ data: {
      answer: 'Answer text',
      sources: [{ page: 7, score: 0.1, text: 'Citable source' }],
    } })

    render(<Dashboard />)

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))
    fireEvent.change(screen.getByPlaceholderText('What does this document say about...?'), {
      target: { value: 'A question' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByText('Citable source')

    expect(within(screen.getByTestId('mock-pdf-pane')).getByText('pdf:alpha.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Citable source'))

    expect(within(screen.getByTestId('mock-pdf-pane')).getByText('citation-page:7')).toBeInTheDocument()
  })

  it('deletes the selected document after confirmation and selects the next one', async () => {
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
    api.delete.mockResolvedValue({ data: { deleted: true } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<Dashboard />)

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))

    fireEvent.click(screen.getByRole('button', { name: 'Delete alpha.pdf' }))

    expect(window.confirm).toHaveBeenCalledWith('Delete "alpha.pdf"? This can\'t be undone.')
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/documents/doc-a'))
    await waitFor(() => expect(chips().getByRole('button', { name: 'bravo.pdf' })).toHaveAttribute('aria-current', 'true'))
    expect(screen.queryByRole('button', { name: 'alpha.pdf' })).not.toBeInTheDocument()
  })

  it('does not delete when the confirmation is cancelled', async () => {
    api.get.mockImplementation(path => {
      if (path === '/documents') return Promise.resolve({ data: [{ id: 'doc-a', filename: 'alpha.pdf' }] })
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<Dashboard />)

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete alpha.pdf' }))

    expect(api.delete).not.toHaveBeenCalled()
    expect(chips().getByRole('button', { name: 'alpha.pdf' })).toBeInTheDocument()
  })

  it('alerts and keeps the document when deletion fails', async () => {
    api.get.mockImplementation(path => {
      if (path === '/documents') return Promise.resolve({ data: [{ id: 'doc-a', filename: 'alpha.pdf' }] })
      if (path === '/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`Unexpected API path: ${path}`))
    })
    api.delete.mockRejectedValue({ message: 'Network Error' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<Dashboard />)

    await waitFor(() => expect(chips().getByRole('button', { name: 'alpha.pdf' })).toHaveAttribute('aria-current', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete alpha.pdf' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete document: Network Error'))
    expect(chips().getByRole('button', { name: 'alpha.pdf' })).toBeInTheDocument()
  })
})
