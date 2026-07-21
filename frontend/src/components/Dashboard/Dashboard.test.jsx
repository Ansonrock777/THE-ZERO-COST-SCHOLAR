import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

describe('Dashboard', () => {
  it('selects the newest saved document and selects a completed upload', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: 'doc-2', filename: 'newest.pdf' },
        { id: 'doc-1', filename: 'older.pdf' },
      ],
    })

    render(<Dashboard />)

    const selector = await screen.findByLabelText('Document')
    expect(selector).toHaveValue('doc-2')

    fireEvent.click(screen.getByRole('button', { name: 'Complete upload' }))

    await waitFor(() => expect(selector).toHaveValue('doc-3'))
    expect(screen.getByRole('option', { name: 'just-uploaded.pdf' })).toBeInTheDocument()
  })
})
