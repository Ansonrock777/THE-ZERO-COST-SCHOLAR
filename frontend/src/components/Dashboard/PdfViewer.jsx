import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, EllipsisVertical, FileText,
  Highlighter, List, Maximize2, MessageSquare, Minus, PanelLeft, Plus, Search,
} from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import api from '../../lib/apiClient'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const MIN_SCALE = 0.7
const MAX_SCALE = 1.8
const FIT_SCALE = 1.05

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

export default function PdfViewer({ document: sourceDocument, citation, onTextSelection, onBack }) {
  const [fileUrl, setFileUrl] = useState('')
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(FIT_SCALE)
  const [pageDraft, setPageDraft] = useState('1')
  const [find, setFind] = useState('')
  const canvasRef = useRef(null)

  const citationTerms = useMemo(
    () => (citation?.text || '').split(/\s+/).filter(term => term.length > 5).slice(0, 8),
    [citation],
  )
  const terms = useMemo(() => {
    const typed = find.trim()
    return typed.length > 2 ? [typed, ...citationTerms] : citationTerms
  }, [find, citationTerms])

  useEffect(() => {
    let url = ''
    let active = true
    if (!sourceDocument) { setFileUrl(''); return undefined }
    api.get(`/documents/${sourceDocument.document_id}/file`, { responseType: 'blob' }).then(({ data }) => {
      if (!active) return
      url = URL.createObjectURL(data)
      setFileUrl(url)
      const citedPage = Number(citation?.page)
      setPage(Number.isInteger(citedPage) && citedPage > 0 ? citedPage : 1)
    })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [sourceDocument?.document_id])

  useEffect(() => {
    const nextPage = Number(citation?.page)
    if (Number.isInteger(nextPage) && nextPage > 0) setPage(nextPage)
  }, [citation])

  useEffect(() => { setPageDraft(String(page)) }, [page])

  const goToPage = value => {
    const next = Number(value)
    if (!Number.isInteger(next) || next < 1) { setPageDraft(String(page)); return }
    setPage(Math.min(pages || next, next))
    canvasRef.current?.scrollTo?.({ top: 0 })
  }

  const highlight = ({ str }) => {
    if (!terms.length) return str
    const regex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
    return str.replace(regex, '<mark>$1</mark>')
  }

  const captureSelection = () => {
    const selection = window.getSelection()?.toString().trim()
    if (selection) onTextSelection?.(selection.slice(0, 1500))
  }

  if (!sourceDocument) {
    return (
      <div className='pdf-empty'>
        <h2>Select a source</h2>
        <p>The original PDF and citation evidence will appear here.</p>
      </div>
    )
  }

  const highlightCount = citation?.text ? 1 : 0

  return (
    <div className='pdf-viewer'>
      <div className='pdf-header'>
        <button type='button' className='icon-button' aria-label='Back to the library' onClick={onBack} disabled={!onBack}>
          <ArrowLeft size={16} strokeWidth={1.8} />
        </button>
        <strong title={sourceDocument.filename}>{sourceDocument.filename}</strong>
        <button type='button' className='icon-button is-accent' aria-label='Document outline'>
          <List size={15} strokeWidth={1.8} />
        </button>
        <button type='button' className='icon-button' aria-label='More document actions'>
          <EllipsisVertical size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className='pdf-toolbar'>
        <button type='button' className='icon-button' aria-label='Toggle thumbnails'>
          <PanelLeft size={15} strokeWidth={1.7} />
        </button>
        <button type='button' className='icon-button' aria-label='Find in document' onClick={() => window.document.getElementById('pdf-find')?.focus()}>
          <Search size={15} strokeWidth={1.7} />
        </button>
        <span className='spacer' />
        <button type='button' className='icon-button sm' aria-label='Previous page' onClick={() => goToPage(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <input
          className='pdf-page-field'
          aria-label='Page number'
          inputMode='numeric'
          value={pageDraft}
          onChange={event => setPageDraft(event.target.value)}
          onBlur={event => goToPage(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); goToPage(event.currentTarget.value) } }}
        />
        <span className='pdf-page-total'>/ {pages || '—'}</span>
        <button type='button' className='icon-button sm' aria-label='Next page' onClick={() => goToPage(page + 1)} disabled={!!pages && page >= pages}>
          <ChevronRight size={14} strokeWidth={2} />
        </button>
        <span className='rule' aria-hidden='true' />
        <button type='button' className='icon-button sm' aria-label='Zoom out' onClick={() => setScale(value => Math.max(MIN_SCALE, value - 0.1))}>
          <Minus size={14} strokeWidth={2} />
        </button>
        <span className='pdf-zoom-value'>{Math.round(scale * 100)}%</span>
        <button type='button' className='icon-button sm' aria-label='Zoom in' onClick={() => setScale(value => Math.min(MAX_SCALE, value + 0.1))}>
          <Plus size={14} strokeWidth={2} />
        </button>
        <button type='button' className='icon-button sm' aria-label='Fit page' onClick={() => setScale(FIT_SCALE)}>
          <Maximize2 size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className='pdf-canvas' ref={canvasRef} onMouseUp={captureSelection}>
        {fileUrl && (
          <div className='pdf-page'>
            <Document file={fileUrl} onLoadSuccess={({ numPages }) => setPages(numPages)} loading='Opening PDF…' error='The PDF could not be displayed.'>
              <Page pageNumber={Math.min(page, pages || page)} scale={scale} customTextRenderer={highlight} />
            </Document>
          </div>
        )}
      </div>

      <div className='pdf-footer'>
        <button type='button' className='icon-button' aria-label='Page thumbnails'>
          <FileText size={15} strokeWidth={1.7} />
        </button>
        <button type='button' className='icon-button' aria-label='Passage notes'>
          <MessageSquare size={15} strokeWidth={1.7} />
        </button>
        <span className='tag tag-accent'>
          <Highlighter size={13} strokeWidth={1.7} aria-hidden='true' />
          <span className='tnum'>{highlightCount} highlight{highlightCount === 1 ? '' : 's'}</span>
        </span>
        <input
          id='pdf-find'
          placeholder='Search in document'
          aria-label='Search in document'
          value={find}
          onChange={event => setFind(event.target.value)}
        />
        <a
          className='icon-button'
          aria-label='Download this document'
          href={fileUrl || undefined}
          download={sourceDocument.filename}
        >
          <Download size={15} strokeWidth={1.7} />
        </a>
      </div>

      {citation?.text && (
        <aside className='citation-excerpt'>
          <div>
            <strong>Referenced passage</strong>
            <button type='button' onClick={() => navigator.clipboard.writeText(`${citation.filename}, p. ${citation.page}`)}>
              <Copy size={13} strokeWidth={1.8} aria-hidden='true' /> Copy citation
            </button>
          </div>
          <p>{citation.text}</p>
        </aside>
      )}
    </div>
  )
}
