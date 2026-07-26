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
  ChevronLeft, ChevronRight, Maximize,
  RefreshCw, Search, X, ZoomIn, ZoomOut,
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

function OutlineItems({ items, onSelect }) {
  return (
    <ol className='space-y-1 text-left'>
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <button
            type='button'
            className='w-full rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-black/5 dark:text-slate-200 dark:hover:bg-slate-800'
            onClick={() => onSelect(item)}
          >
            {item.title}
          </button>
          {item.items?.length > 0 && <div className='pl-3'><OutlineItems items={item.items} onSelect={onSelect} /></div>}
        </li>
      ))}
    </ol>
  )
}

export default function PdfViewerPane({ selectedDocument, documents = [], activeCitation, onClose, onTextSelection, onSelectDocument }) {
  const { bytes, loading, error, notFound, refetch } = usePdfDocument(selectedDocument?.document_id)
  const file = useMemo(() => (bytes ? { data: bytes } : null), [bytes])

  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [highlight, setHighlight] = useState(null) // { page, rects }
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfDocument, setPdfDocument] = useState(null)
  const [outline, setOutline] = useState(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const containerRef = useRef(null)
  const pagesViewportRef = useRef(null)
  const pageRefs = useRef({})
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
    setPdfDocument(null)
    setOutline(null)
    setOutlineOpen(false)
    setSearchOpen(false)
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
    const viewport = pagesViewportRef.current
    const element = pageRefs.current[activeCitation.page]
    if (viewport && element) {
      const viewportRect = viewport.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const targetTop = viewport.scrollTop + elementRect.top - viewportRect.top - 16
      viewport.scrollTo?.({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }
    if (textIndexByPage.current[activeCitation.page]) {
      computeHighlightForPage(activeCitation.page)
    }
  }, [activeCitation, computeHighlightForPage])

  const handleGetTextSuccess = useCallback((page, textContent) => {
    rawItemsByPage.current[page] = textContent.items
  }, [])

  const handleRenderTextLayerSuccess = useCallback((page) => {
    const wrapper = pageRefs.current[page]
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

  const scrollToPage = (page) => {
    setPageNumber(page)
    const viewport = pagesViewportRef.current
    const element = pageRefs.current[page]
    if (viewport && element) {
      const viewportRect = viewport.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const targetTop = viewport.scrollTop + elementRect.top - viewportRect.top - 16
      viewport.scrollTo?.({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }
  }
  const goPrev = () => scrollToPage(Math.max(1, pageNumberRef.current - 1))
  const goNext = () => scrollToPage(Math.min(numPages || 1, pageNumberRef.current + 1))
  const documentIndex = documents.findIndex(document => document.document_id === selectedDocument?.document_id)
  const goPreviousDocument = () => { if (documentIndex > 0) onSelectDocument?.(documents[documentIndex - 1].document_id) }
  const goNextDocument = () => { if (documentIndex >= 0 && documentIndex < documents.length - 1) onSelectDocument?.(documents[documentIndex + 1].document_id) }

  const handlePagesScroll = () => {
    const viewport = pagesViewportRef.current
    if (!viewport || !numPages) return
    const viewportTop = viewport.getBoundingClientRect().top
    let closestPage = pageNumberRef.current
    let closestDistance = Number.POSITIVE_INFINITY
    for (let page = 1; page <= numPages; page += 1) {
      const element = pageRefs.current[page]
      if (!element) continue
      const distance = Math.abs(element.getBoundingClientRect().top - viewportTop)
      if (distance < closestDistance) {
        closestDistance = distance
        closestPage = page
      }
    }
    if (closestPage !== pageNumberRef.current) setPageNumber(closestPage)
  }
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

  const handleDocumentLoadSuccess = useCallback(pdf => {
    setNumPages(pdf.numPages)
    setPdfDocument(pdf)
  }, [])

  const toggleOutline = async () => {
    if (outlineOpen) { setOutlineOpen(false); return }
    setOutlineOpen(true)
    if (outline !== null) return
    if (!pdfDocument?.getOutline) { setOutline([]); return }
    setOutlineLoading(true)
    try {
      setOutline((await pdfDocument.getOutline()) || [])
    } catch {
      setOutline([])
    } finally {
      setOutlineLoading(false)
    }
  }

  const openOutlineItem = async item => {
    if (!pdfDocument?.getDestination || !pdfDocument?.getPageIndex) return
    try {
      const destination = typeof item.dest === 'string'
        ? await pdfDocument.getDestination(item.dest)
        : item.dest
      if (!destination?.[0]) return
      setPageNumber((await pdfDocument.getPageIndex(destination[0])) + 1)
      setOutlineOpen(false)
    } catch {
      // A malformed outline entry should not break the PDF viewer.
    }
  }

  const captureSelection = () => {
    const selection = window.getSelection()?.toString().trim()
    if (selection) onTextSelection?.(selection.slice(0, 1500))
  }

  return (
    <div ref={containerRef} className='pdf-viewer-pane flex h-full flex-col bg-white dark:bg-slate-900'>
      <div className='flex items-center justify-between gap-2 border-b border-black/[0.06] px-3 py-2 dark:border-slate-700'>
        <div className='flex min-w-0 items-center gap-2'>
          <div className='flex items-center gap-1'>
            <button type='button' onClick={goPreviousDocument} disabled={documentIndex <= 0} className='rounded-md p-1.5 text-ink-muted hover:bg-black/5 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800' aria-label='Previous document'>
              <ChevronLeft size={16} />
            </button>
            <button type='button' onClick={goNextDocument} disabled={documentIndex < 0 || documentIndex >= documents.length - 1} className='rounded-md p-1.5 text-ink-muted hover:bg-black/5 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800' aria-label='Next document'>
              <ChevronRight size={16} />
            </button>
          </div>
          <span className='truncate text-sm font-medium text-ink dark:text-slate-200'>
            {selectedDocument?.filename ?? 'No document selected'}
          </span>
        </div>
        <div className='flex items-center gap-1 text-slate-300'>
          {searchOpen && (
            <div className='relative flex items-center'>
              <Search size={13} className='pointer-events-none absolute left-2 text-slate-300' />
              <input
                autoFocus
                aria-label='Document search'
                placeholder='Search in document'
                className='w-44 rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-7 text-xs text-ink dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              />
              <button
                type='button'
                aria-label='Close document search'
                onClick={() => setSearchOpen(false)}
                className='absolute right-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              >
                <X size={13} />
              </button>
            </div>
          )}
          <button
            type='button'
            aria-label='Search document'
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(open => !open)}
            className='rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-slate-800'
          >
            <Search size={16} />
          </button>
          {outlineOpen && (
              <section role='region' aria-label='Document outline' className='absolute right-0 top-9 z-40 w-64 rounded-lg border border-black/[0.08] bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900'>
                <h2 className='px-2 pb-1 text-xs font-semibold text-ink dark:text-slate-200'>Document outline</h2>
                {outlineLoading && <p className='px-2 py-2 text-xs text-slate-400'>Loading outline…</p>}
                {!outlineLoading && outline?.length > 0 && <OutlineItems items={outline} onSelect={openOutlineItem} />}
                {!outlineLoading && outline?.length === 0 && <p className='px-2 py-2 text-xs text-slate-400'>This document has no outline.</p>}
              </section>
          )}
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
            onChange={e => scrollToPage(Number(e.target.value))}
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

      <div ref={pagesViewportRef} onScroll={handlePagesScroll} className='scrollbar-slim flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950'>
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
          <Document file={file} onLoadSuccess={handleDocumentLoadSuccess} loading={null}>
            <div className='flex flex-col items-center gap-4'>
              {Array.from({ length: numPages }, (_, index) => index + 1).map(page => (
                <div
                  key={page}
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
                  className='w-fit select-text'
                  onMouseUp={captureSelection}
                >
                  <Page
                    pageNumber={page}
                    scale={scale}
                    inputRef={element => { pageRefs.current[page] = element }}
                    onGetTextSuccess={textContent => handleGetTextSuccess(page, textContent)}
                    onRenderTextLayerSuccess={() => handleRenderTextLayerSuccess(page)}
                    renderAnnotationLayer={false}
                    className='shadow'
                  >
                    {highlight && highlight.page === page && (
                      <PdfHighlightOverlay rects={highlight.rects} label={activeCitation?.index ?? ''} />
                    )}
                  </Page>
                </div>
              ))}
            </div>
          </Document>
        )}
      </div>

    </div>
  )
}
