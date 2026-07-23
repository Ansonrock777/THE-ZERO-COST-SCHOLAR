import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/apiClient', () => ({
  default: { get: vi.fn() },
}))

import api from '../../lib/apiClient'
import Sidebar from './Sidebar'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const documents = [
  { document_id: 'doc-1', filename: 'newest.pdf' },
  { document_id: 'doc-2', filename: 'older.pdf' },
]

describe('Sidebar', () => {
  it('renders the app title and document count', () => {
    api.get.mockResolvedValue({ data: [] })

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={vi.fn()}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={vi.fn()}
        onSelectHistory={vi.fn()}
      />,
    )

    expect(screen.getByText('The Zero-Cost Scholar')).toBeInTheDocument()
    expect(screen.getByText('Documents (2)')).toBeInTheDocument()
  })

  it('calls onNewInquiry when the button is clicked', () => {
    api.get.mockResolvedValue({ data: [] })
    const onNewInquiry = vi.fn()

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={vi.fn()}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={onNewInquiry}
        onSelectHistory={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /new inquiry/i }))
    expect(onNewInquiry).toHaveBeenCalledTimes(1)
  })

  it('selecting a document calls onSelectDocument', () => {
    api.get.mockResolvedValue({ data: [] })
    const onSelectDocument = vi.fn()

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={onSelectDocument}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={vi.fn()}
        onSelectHistory={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'older.pdf' }))
    expect(onSelectDocument).toHaveBeenCalledWith('doc-2')
  })

  it('typing in the search box filters the history list below', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: '1', question: 'What is BM25?', answer: '', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } },
        { id: '2', question: 'Compare precision and recall', answer: '', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } },
      ],
    })

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={vi.fn()}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={vi.fn()}
        onSelectHistory={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText('What is BM25?')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search inquiries'), { target: { value: 'precision' } })

    expect(screen.queryByText('What is BM25?')).not.toBeInTheDocument()
    expect(screen.getByText('Compare precision and recall')).toBeInTheDocument()
  })

  it('clicking a history entry calls onSelectHistory', async () => {
    const log = { id: '1', question: 'What is BM25?', answer: 'A ranking function.', created_at: new Date().toISOString(), user_documents: { filename: 'ir.pdf' } }
    api.get.mockResolvedValue({ data: [log] })
    const onSelectHistory = vi.fn()

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={vi.fn()}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={vi.fn()}
        onSelectHistory={onSelectHistory}
      />,
    )

    await waitFor(() => expect(screen.getByText('What is BM25?')).toBeInTheDocument())
    fireEvent.click(screen.getByText('What is BM25?'))

    expect(onSelectHistory).toHaveBeenCalledWith(log)
  })

  it('calls onDeleteDocument with the document to delete', () => {
    api.get.mockResolvedValue({ data: [] })
    const onDeleteDocument = vi.fn()

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={vi.fn()}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={vi.fn()}
        onSelectHistory={vi.fn()}
        onDeleteDocument={onDeleteDocument}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete older.pdf' }))
    expect(onDeleteDocument).toHaveBeenCalledWith(documents[1])
  })

  it('calls onUploadClick when the upload button is clicked', () => {
    api.get.mockResolvedValue({ data: [] })
    const onUploadClick = vi.fn()

    render(
      <Sidebar
        documents={documents}
        selectedId='doc-1'
        onSelectDocument={vi.fn()}
        loadingDocuments={false}
        documentsError=''
        onNewInquiry={vi.fn()}
        onSelectHistory={vi.fn()}
        onUploadClick={onUploadClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Upload a document' }))
    expect(onUploadClick).toHaveBeenCalledTimes(1)
  })
})
