import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '../../lib/apiClient'
import Dashboard from './Dashboard'

vi.mock('../../lib/apiClient', () => ({
  default: { get: vi.fn() },
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
})
