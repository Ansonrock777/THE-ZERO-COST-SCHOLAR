import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockUsePdfDocument = vi.fn()
vi.mock('../../hooks/usePdfDocument', () => ({
  usePdfDocument: (...args) => mockUsePdfDocument(...args),
}))

// Real pdf.js/canvas rendering is out of scope for jsdom — stub react-pdf
// entirely and exercise only PdfViewerPane's own toolbar/state/fallback logic.
vi.mock('react-pdf', () => ({
  Document: ({ file, onLoadSuccess, children }) => {
    useEffect(() => {
      if (file && onLoadSuccess) onLoadSuccess({ numPages: 5 })
    }, [file, onLoadSuccess])
    return <div data-testid='mock-document'>{children}</div>
  },
  Page: ({ pageNumber, children }) => (
    <div data-testid='mock-page'>
      {`rendered-page-${pageNumber}`}
      {children}
    </div>
  ),
  pdfjs: { GlobalWorkerOptions: {} },
}))

import PdfViewerPane from './PdfViewerPane'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const doc = { document_id: 'doc-1', filename: 'guide.pdf' }

describe('PdfViewerPane', () => {
  it('shows a placeholder when no document is selected', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: null, loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={null} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getByText('Select a document to preview its PDF.')).toBeInTheDocument()
  })

  it('shows a loading message while fetching', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: null, loading: true, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getByText('Loading PDF...')).toBeInTheDocument()
  })

  it('shows a fallback message when the PDF was never stored', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: null, loading: false, error: '', notFound: true, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getByText('PDF preview unavailable, re-upload to view.')).toBeInTheDocument()
  })

  it('shows an error message on fetch failure', () => {
    mockUsePdfDocument.mockReturnValue({
      bytes: null, loading: false, error: 'Unable to load PDF: Network Error', notFound: false, refetch: vi.fn(),
    })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getByText('Unable to load PDF: Network Error')).toBeInTheDocument()
  })

  it('renders the document and page count once bytes are loaded', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getByText('guide.pdf')).toBeInTheDocument()
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
    expect(screen.getByText('rendered-page-1')).toBeInTheDocument()
  })

  it('reload resets to page 1 and 100% zoom, and refetches', () => {
    const refetch = vi.fn()
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByText('125%')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Reload PDF'))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('navigates pages with next/previous, clamped to bounds', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getByLabelText('Previous page')).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Next page'))
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled()
  })

  it('jumps to the cited page when activeCitation changes', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    const { rerender } = render(
      <PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />,
    )

    rerender(
      <PdfViewerPane
        selectedDocument={doc}
        activeCitation={{ page: 3, text: 'cited passage', index: 1, nonce: 1 }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })

  it('disables download with no bytes, and downloads once bytes are present', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: null, loading: false, error: '', notFound: false, refetch: vi.fn() })
    const { rerender } = render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Download PDF')).toBeDisabled()

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
    mockUsePdfDocument.mockReturnValue({
      bytes: new Uint8Array([1, 2, 3]), loading: false, error: '', notFound: false, refetch: vi.fn(),
    })
    rerender(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Download PDF'))
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('calls onClose from the mobile back button', () => {
    const onClose = vi.fn()
    mockUsePdfDocument.mockReturnValue({ bytes: null, loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={null} activeCitation={null} onClose={onClose} />)

    fireEvent.click(screen.getByLabelText('Close PDF viewer'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
