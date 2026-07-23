// frontend/src/components/Dashboard/PdfViewerPane.jsx
// Real PDF viewer for the currently selected document. When `activeCitation`
// is set (a citation badge was clicked elsewhere in the app), jumps to its
// page and — best-effort, see lib/pdfTextMatch.js — draws a highlight over
// the cited passage. Missing/failed highlight matches degrade silently to a
// plain page jump; that is expected behavior, not a bug.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Maximize,
  MessageSquare, MoreVertical, RefreshCw, Search, Tag, ZoomIn, ZoomOut,
} from 'lucide-react'
import { usePdfDocument } from '../../hooks/usePdfDocument'
import { buildPageTextIndex, findHighlightRects } from '../../lib/pdfTextMatch'
import PdfHighlightOverlay from './PdfHighlightOverlay'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SWIPE_THRESHOLD = 60

export default function PdfViewerPane({ selectedDocument, activeCitation, onClose }) {
  const { bytes, loading, error, notFound, refetch } = usePdfDocument(selectedDocument?.document_id)
  const file = useMemo(() => (bytes ? { data: bytes } : null), [bytes])

  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [highlight, setHighlight] = useState(null) // { page, rects }
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef(null)
  const pageWrapperRef = useRef(null)
  const pageNumberRef = useRef(1)
  const rawItemsByPage = useRef({})
  const textIndexByPage = useRef({})
  const dragStateRef = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    pageNumberRef.current = pageNumber
  }, [pageNumber])

  // Reset viewer state whenever the selected document changes. `numPages`
  // is deliberately left alone here — it's about to be overwritten by the
  // new document's own onLoadSuccess, and racing that reset against it (both
  // firing from the same mount) only serves to briefly clobber the real
  // value; the "Loading PDF..." state already hides any stale page count.
  useEffect(() => {
    setPageNumber(1)
    setScale(1)
    setHighlight(null)
    rawItemsByPage.current = {}
    textIndexByPage.current = {}
  }, [selectedDocument?.document_id])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const computeHighlightForPage = useCallback((page) => {
    const pageIndex = textIndexByPage.current[page]
    if (!pageIndex || !activeCitation || activeCitation.page !== page) return
    const result = findHighlightRects(pageIndex, activeCitation.text)
    setHighlight(result.matched ? { page, rects: result.rects } : null)
  }, [activeCitation])

  // Citation click: jump to its page. The highlight itself is computed once
  // that page's text layer finishes rendering (see onRenderTextLayerSuccess
  // below) — or immediately, if we already have that page's text indexed.
  useEffect(() => {
    if (!activeCitation || typeof activeCitation.page !== 'number') return
    setPageNumber(activeCitation.page)
    if (textIndexByPage.current[activeCitation.page]) {
      computeHighlightForPage(activeCitation.page)
    }
  }, [activeCitation, computeHighlightForPage])

  const handleGetTextSuccess = useCallback((textContent) => {
    rawItemsByPage.current[pageNumberRef.current] = textContent.items
  }, [])

  const handleRenderTextLayerSuccess = useCallback(() => {
    const page = pageNumberRef.current
    const wrapper = pageWrapperRef.current
    const items = rawItemsByPage.current[page]
    if (!wrapper || !items) return

    const textLayerEl = wrapper.querySelector('.react-pdf__Page__textContent')
    if (!textLayerEl) return

    const spanEls = Array.from(textLayerEl.querySelectorAll('[role="presentation"]'))
    const rects = spanEls.map(el => el.getBoundingClientRect())
    const containerRect = wrapper.getBoundingClientRect()

    textIndexByPage.current[page] = buildPageTextIndex(items, rects, containerRect)
    computeHighlightForPage(page)
  }, [computeHighlightForPage])

  const goPrev = () => setPageNumber(p => Math.max(1, p - 1))
  const goNext = () => setPageNumber(p => Math.min(numPages || 1, p + 1))
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, +(s - 0.25).toFixed(2)))
  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, +(s + 0.25).toFixed(2)))

  // Mouse/touch drag on the page itself: horizontal swipe past the
  // threshold flips a page, mirroring the on-screen slider above.
  const handlePageDragStart = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragStateRef.current = { startX: e.clientX }
    setIsDragging(true)
  }
  const handlePageDragMove = (e) => {
    if (!dragStateRef.current) return
    setDragX(e.clientX - dragStateRef.current.startX)
  }
  const endPageDrag = () => {
    if (!dragStateRef.current) return
    if (dragX <= -SWIPE_THRESHOLD) goNext()
    else if (dragX >= SWIPE_THRESHOLD) goPrev()
    dragStateRef.current = null
    setIsDragging(false)
    setDragX(0)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen?.()
    }
  }

  const handleReload = () => {
    setScale(1)
    setPageNumber(1)
    refetch()
  }

  const handleDownload = () => {
    if (!bytes) return
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = selectedDocument?.filename || 'document.pdf'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div ref={containerRef} className='flex h-full flex-col bg-white dark:bg-slate-900'>
      <div className='flex items-center justify-between gap-2 border-b border-black/[0.06] px-3 py-2 dark:border-slate-700'>
        <div className='flex min-w-0 items-center gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1.5 text-ink-muted hover:bg-black/5 xl:hidden dark:text-slate-300 dark:hover:bg-slate-800'
            aria-label='Close PDF viewer'
          >
            <ArrowLeft size={16} />
          </button>
          <span className='truncate text-sm font-medium text-ink dark:text-slate-200'>
            {selectedDocument?.filename ?? 'No document selected'}
          </span>
        </div>
        <div className='flex items-center gap-1 text-slate-300'>
          <button type='button' disabled className='rounded-md p-1.5' aria-label='Document outline' title='Coming soon'>
            <FileText size={16} />
          </button>
          <button type='button' disabled className='rounded-md p-1.5' aria-label='More options' title='Coming soon'>
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      <div className='flex flex-wrap items-center justify-center gap-2 border-b border-black/[0.06] bg-cream px-3 py-2 text-ink-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'>
        <div className='flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-black/[0.06] dark:bg-slate-900 dark:ring-slate-700'>
          <button
            type='button'
            onClick={goPrev}
            disabled={pageNumber <= 1}
            className='rounded-full p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700'
            aria-label='Previous page'
          >
            <ChevronLeft size={16} />
          </button>
          <span className='min-w-[3.5rem] text-center text-xs tabular-nums'>
            {numPages ? `${pageNumber} / ${numPages}` : '–'}
          </span>
          <input
            type='range'
            min={1}
            max={numPages || 1}
            step={1}
            value={pageNumber}
            disabled={!numPages}
            onChange={e => setPageNumber(Number(e.target.value))}
            aria-label='Page slider'
            className='h-1 w-28 cursor-pointer accent-forest disabled:cursor-not-allowed disabled:opacity-30 sm:w-48'
          />
          <button
            type='button'
            onClick={goNext}
            disabled={!numPages || pageNumber >= numPages}
            className='rounded-full p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700'
            aria-label='Next page'
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className='ml-auto flex items-center gap-1'>
          <button
            type='button'
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className='rounded p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700'
            aria-label='Zoom out'
          >
            <ZoomOut size={16} />
          </button>
          <span className='min-w-[3rem] text-center text-xs tabular-nums'>{Math.round(scale * 100)}%</span>
          <button
            type='button'
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className='rounded p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700'
            aria-label='Zoom in'
          >
            <ZoomIn size={16} />
          </button>
          <button
            type='button'
            onClick={toggleFullscreen}
            className={`rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 ${isFullscreen ? 'text-slate-800 dark:text-white' : ''}`}
            aria-label='Toggle fullscreen'
          >
            <Maximize size={16} />
          </button>
          <button
            type='button'
            onClick={handleReload}
            className='rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700'
            aria-label='Reload PDF'
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className='scrollbar-slim flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950'>
        {!selectedDocument && (
          <p className='mt-10 text-center text-sm text-slate-400'>Select a document to preview its PDF.</p>
        )}
        {selectedDocument && loading && (
          <p className='mt-10 text-center text-sm text-slate-400'>Loading PDF...</p>
        )}
        {selectedDocument && notFound && !loading && (
          <p className='mt-10 text-center text-sm text-slate-400'>
            PDF preview unavailable, re-upload to view.
          </p>
        )}
        {selectedDocument && error && !loading && (
          <p className='mt-10 text-center text-sm text-red-500'>{error}</p>
        )}
        {selectedDocument && file && !loading && (
          <Document file={file} onLoadSuccess={({ numPages: total }) => setNumPages(total)} loading={null}>
            <div
              onPointerDown={handlePageDragStart}
              onPointerMove={handlePageDragMove}
              onPointerUp={endPageDrag}
              onPointerLeave={endPageDrag}
              onPointerCancel={endPageDrag}
              style={{
                transform: `translateX(${dragX}px)`,
                transition: isDragging ? 'none' : 'transform 200ms ease',
                touchAction: 'pan-y',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              className='mx-auto w-fit select-none'
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                inputRef={pageWrapperRef}
                onGetTextSuccess={handleGetTextSuccess}
                onRenderTextLayerSuccess={handleRenderTextLayerSuccess}
                renderAnnotationLayer={false}
                className='shadow'
              >
                {highlight && highlight.page === pageNumber && (
                  <PdfHighlightOverlay rects={highlight.rects} label={activeCitation?.index ?? ''} />
                )}
              </Page>
            </div>
          </Document>
        )}
      </div>

      <div className='flex items-center justify-between gap-2 border-t border-black/[0.06] px-3 py-2 dark:border-slate-700'>
        <div className='flex items-center gap-1 text-slate-300'>
          <button type='button' disabled className='rounded p-1.5' aria-label='Pages' title='Coming soon'>
            <FileText size={15} />
          </button>
          <button type='button' disabled className='rounded p-1.5' aria-label='Comments' title='Coming soon'>
            <MessageSquare size={15} />
          </button>
          <button type='button' disabled className='rounded p-1.5' aria-label='Tags' title='Coming soon'>
            <Tag size={15} />
          </button>
        </div>
        <div className='relative max-w-xs flex-1'>
          <Search size={13} className='pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-300' />
          <input
            disabled
            placeholder='Search in document'
            title='Coming soon'
            className='w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800'
          />
        </div>
        <button
          type='button'
          onClick={handleDownload}
          disabled={!bytes}
          className='rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800'
          aria-label='Download PDF'
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  )
}
