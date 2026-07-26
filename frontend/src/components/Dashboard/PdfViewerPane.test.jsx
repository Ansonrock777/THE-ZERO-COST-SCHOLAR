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
  Page: ({ pageNumber, children, inputRef }) => (
    <div ref={inputRef} data-testid='mock-page'>
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
  vi.restoreAllMocks()
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

  it('renders every PDF page in a scrollable document', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.getAllByTestId('mock-page')).toHaveLength(5)
    expect(screen.getByText('rendered-page-5')).toBeInTheDocument()
  })

  it('removes the document outline control to make room for document navigation', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Document outline' })).not.toBeInTheDocument()
  })

  it('toggles document search in the top toolbar and removes the bottom toolbar', () => {
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    expect(screen.queryByPlaceholderText('Search in document')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Pages')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Comments')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tags')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Download PDF')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Search document' }))
    expect(screen.getByPlaceholderText('Search in document')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close document search' }))
    expect(screen.queryByPlaceholderText('Search in document')).not.toBeInTheDocument()
  })

  it('reports selected PDF text without disabling native text selection', () => {
    const onTextSelection = vi.fn()
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected passage' })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} onTextSelection={onTextSelection} />)
    fireEvent.mouseUp(screen.getAllByTestId('mock-page')[0])

    expect(onTextSelection).toHaveBeenCalledWith('selected passage')
    expect(screen.getAllByTestId('mock-page')[0].className).not.toContain('select-none')
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

  it('scrolls the selected page into view when the page slider changes', () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
    mockUsePdfDocument.mockReturnValue({ bytes: new Uint8Array([1]), loading: false, error: '', notFound: false, refetch: vi.fn() })

    render(<PdfViewerPane selectedDocument={doc} activeCitation={null} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Page slider'), { target: { value: '4' } })

    expect(screen.getByText('4 / 5')).toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalled()
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

  it('navigates between documents from the PDF header', () => {
    const onSelectDocument = vi.fn()
    mockUsePdfDocument.mockReturnValue({ bytes: null, loading: false, error: '', notFound: false, refetch: vi.fn() })

    const documents = [
      { document_id: 'doc-1', filename: 'one.pdf' },
      { document_id: 'doc-2', filename: 'two.pdf' },
      { document_id: 'doc-3', filename: 'three.pdf' },
    ]
    render(<PdfViewerPane selectedDocument={documents[1]} documents={documents} onSelectDocument={onSelectDocument} />)

    fireEvent.click(screen.getByLabelText('Previous document'))
    fireEvent.click(screen.getByLabelText('Next document'))
    expect(onSelectDocument).toHaveBeenNthCalledWith(1, 'doc-1')
    expect(onSelectDocument).toHaveBeenNthCalledWith(2, 'doc-3')
  })
})
