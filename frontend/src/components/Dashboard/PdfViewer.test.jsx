import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children, onLoadSuccess }) => <div data-testid='document' ref={() => onLoadSuccess?.({ numPages: 8 })}>{children}</div>,
  Page: ({ pageNumber, customTextRenderer }) => <div>Page {pageNumber}<span dangerouslySetInnerHTML={{ __html: customTextRenderer({ str: 'important evidence statement' }) }} /></div>,
}))
vi.mock('../../lib/apiClient', () => ({ default: { get: vi.fn().mockResolvedValue({ data: new Blob(['pdf']) }) } }))
import api from '../../lib/apiClient'
import PdfViewer from './PdfViewer'

beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:pdf'); URL.revokeObjectURL = vi.fn(); Object.assign(navigator, { clipboard: { writeText: vi.fn() } }) })
afterEach(cleanup)

describe('PdfViewer', () => {
  it('loads authenticated bytes, opens the cited page, highlights, and cleans up', async () => {
    const view = render(<PdfViewer document={{ document_id: 'doc-1', filename: 'guide.pdf' }} citation={{ filename: 'guide.pdf', page: 4, text: 'important evidence statement' }} />)
    expect(await screen.findByText(/Page 4/)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/documents/doc-1/file', { responseType: 'blob' })
    expect(document.querySelector('mark')).toHaveTextContent('important')
    fireEvent.click(screen.getByRole('button', { name: /copy citation/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('guide.pdf, p. 4')
    view.unmount()
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf'))
  })
})
