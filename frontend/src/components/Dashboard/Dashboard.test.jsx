import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../lib/apiClient'
import Dashboard from './Dashboard'

vi.mock('../../lib/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('./PdfViewerPane', () => ({ default: ({ selectedDocument, activeCitation }) => (
  <div data-testid='mock-pdf'>PDF: {selectedDocument?.filename || 'none'} {activeCitation ? `citation-page:${activeCitation.page}` : ''}</div>
) }))
vi.mock('./ChatPane', () => ({ default: ({ documentIds, summary, onCitationClick, onEnsureConversation }) => (
  <div>
    <span>Chat with {documentIds.join(',')} {summary}</span>
    <button onClick={() => onCitationClick({ document_id: 'doc-a', page: 7, text: 'Citable source' })}>Cite</button>
    <button onClick={() => onEnsureConversation('First research question')}>Send first query</button>
  </div>
) }))
vi.mock('./UploadPanel', () => ({ default: () => <button>Upload PDF</button> }))
vi.mock('./SettingsPanel', () => ({ default: ({ open }) => (open ? <div>Reader settings</div> : null) }))

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
    expect(await screen.findByTestId('mock-pdf')).toHaveTextContent('PDF: archive.pdf')
  })

  it('restores a selected conversation and its documents', async () => {
    render(<Dashboard />)
    fireEvent.click((await screen.findByText('Prior inquiry')).closest('button'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/chat-a/messages'))
    expect(screen.getByText(/chat with doc-b/i)).toBeInTheDocument()
  })

  it('keeps the selected document when the first query creates a chat', async () => {
    api.post.mockResolvedValue({
      data: { id: 'chat-new', title: '', document_ids: ['doc-a'], pinned: false },
    })
    render(<Dashboard />)
    await screen.findByText(/chat with doc-a/i)

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(screen.getByText(/^Chat with\s*$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'archive.pdf' }))
    expect(screen.getByText(/chat with doc-a/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Send first query' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/conversations', {
      document_ids: ['doc-a'],
      title: 'First research question',
    }))
    expect(screen.getByText(/chat with doc-a/i)).toBeInTheDocument()
    expect(screen.getByText('First research question')).toBeInTheDocument()
  })

  it('clicking a citation hands its page to the PDF pane', async () => {
    render(<Dashboard />)
    await screen.findByText(/chat with doc-a/i)
    expect(await screen.findByTestId('mock-pdf')).toHaveTextContent('PDF: archive.pdf')

    fireEvent.click(screen.getByRole('button', { name: 'Cite' }))

    expect(await screen.findByTestId('mock-pdf')).toHaveTextContent('citation-page:7')
  })

  it('pins a conversation through the sidebar', async () => {
    api.patch.mockResolvedValue({ data: {} })
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pin Prior inquiry' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/conversations/chat-a', { pinned: true }))
  })

  it('deletes a conversation and removes it from history', async () => {
    api.delete.mockResolvedValue({ data: { deleted: true } })
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Prior inquiry' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/conversations/chat-a'))
    await waitFor(() => expect(screen.queryByText('Prior inquiry')).not.toBeInTheDocument())
  })

  it('renames a conversation when a new title is supplied', async () => {
    api.patch.mockResolvedValue({ data: {} })
    vi.spyOn(window, 'prompt').mockReturnValue('Renamed inquiry')
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Prior inquiry' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/conversations/chat-a', { title: 'Renamed inquiry' }))
    expect(await screen.findByText('Renamed inquiry')).toBeInTheDocument()
  })

  it('surfaces an error banner when the workspace cannot load', async () => {
    api.get.mockRejectedValue(new Error('offline'))
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your workspace.')
  })

  it('opens the settings panel from the top bar', async () => {
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: /settings/i }))
    expect(screen.getByText('Reader settings')).toBeInTheDocument()
  })
})
