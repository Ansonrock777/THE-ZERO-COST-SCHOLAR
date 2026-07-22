import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Minus, Plus } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import api from '../../lib/apiClient'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

export default function PdfViewer({ document, citation, onTextSelection }) {
  const [fileUrl, setFileUrl] = useState('')
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1.05)
  const terms = useMemo(() => (citation?.text || '').split(/\s+/).filter(term => term.length > 5).slice(0, 8), [citation])

  useEffect(() => {
    let url = ''
    let active = true
    if (!document) { setFileUrl(''); return undefined }
    api.get(`/documents/${document.document_id}/file`, { responseType: 'blob' }).then(({ data }) => {
      if (!active) return
      url = URL.createObjectURL(data)
      setFileUrl(url)
      const citedPage = Number(citation?.page)
      setPage(Number.isInteger(citedPage) && citedPage > 0 ? citedPage : 1)
    })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [document?.document_id])

  useEffect(() => {
    const nextPage = Number(citation?.page)
    if (Number.isInteger(nextPage) && nextPage > 0) setPage(nextPage)
  }, [citation])

  const highlight = ({ str }) => {
    if (!terms.length) return str
    const regex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
    return str.replace(regex, '<mark>$1</mark>')
  }

  const captureSelection = () => {
    const selection = window.getSelection()?.toString().trim()
    if (selection) onTextSelection?.(selection.slice(0, 1500))
  }

  if (!document) return <div className='pdf-empty'><h2>Select a source</h2><p>The original PDF and citation evidence will appear here.</p></div>

  return (
    <div className='pdf-viewer'>
      <div className='pdf-toolbar'>
        <strong title={document.filename}>{document.filename}</strong>
        <div>
          <button aria-label='Previous page' onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>
          <span>{page} / {pages || '—'}</span>
          <button aria-label='Next page' onClick={() => setPage(value => Math.min(pages || value + 1, value + 1))}><ChevronRight size={16} /></button>
          <button aria-label='Zoom out' onClick={() => setScale(value => Math.max(.7, value - .1))}><Minus size={16} /></button>
          <button aria-label='Zoom in' onClick={() => setScale(value => Math.min(1.8, value + .1))}><Plus size={16} /></button>
        </div>
      </div>
      <div className='pdf-canvas' onMouseUp={captureSelection}>
        {fileUrl && <Document file={fileUrl} onLoadSuccess={({ numPages }) => setPages(numPages)} loading='Opening PDF…' error='The PDF could not be displayed.'>
          <Page pageNumber={Math.min(page, pages || page)} scale={scale} customTextRenderer={highlight} />
        </Document>}
      </div>
      {citation?.text && <aside className='citation-excerpt'><div><strong>Referenced passage</strong><button type='button' onClick={() => navigator.clipboard.writeText(`${citation.filename}, p. ${citation.page}`)}><Copy size={13} /> Copy citation</button></div><p>{citation.text}</p></aside>}
    </div>
  )
}
