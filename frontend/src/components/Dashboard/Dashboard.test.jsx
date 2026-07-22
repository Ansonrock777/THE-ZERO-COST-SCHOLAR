import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../lib/apiClient'
import Dashboard from './Dashboard'

vi.mock('../../lib/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('./PdfViewer', () => ({ default: ({ document }) => <div>PDF: {document?.filename || 'none'}</div> }))
vi.mock('./ChatPane', () => ({ default: ({ documentIds, summary }) => <div>Chat with {documentIds.join(',')} {summary}</div> }))
vi.mock('./UploadPanel', () => ({ default: () => <button>Upload PDF</button> }))

beforeEach(() => {
  localStorage.clear()
  api.get.mockImplementation(path => {
    if (path === '/documents') return Promise.resolve({ data: [{ id: 'doc-a', filename: 'archive.pdf', summary: 'A useful overview.' }, { id: 'doc-b', filename: 'handbook.pdf' }] })
    if (path === '/conversations') return Promise.resolve({ data: [{ id: 'chat-a', title: 'Prior inquiry', document_ids: ['doc-b'], pinned: false }] })
    if (path === '/conversations/chat-a/messages') return Promise.resolve({ data: [{ role: 'assistant', content: 'Saved answer' }] })
    return Promise.reject(new Error(path))
  })
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Dashboard production workspace', () => {
  it('loads the library, permits multi-document selection, and shows the summary', async () => {
    render(<Dashboard />)
    expect(await screen.findByText(/chat with doc-a/i)).toHaveTextContent('A useful overview.')
    fireEvent.click(screen.getByRole('checkbox', { name: 'handbook.pdf' }))
    expect(screen.getByText(/chat with doc-a,doc-b/i)).toBeInTheDocument()
    expect(screen.getByText('PDF: archive.pdf')).toBeInTheDocument()
  })

  it('restores a selected conversation and its documents', async () => {
    render(<Dashboard />)
    fireEvent.click((await screen.findByText('Prior inquiry')).closest('button'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/chat-a/messages'))
    expect(screen.getByText(/chat with doc-b/i)).toBeInTheDocument()
  })
})
