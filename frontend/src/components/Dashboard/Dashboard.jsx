// frontend/src/components/Dashboard/Dashboard.jsx
// Main protected route — responsive 3-pane layout: sidebar (drawer <xl),
// center chat, PDF pane (drawer <xl). Owns all cross-pane state.
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { supabase } from '../../lib/supabaseClient'
import api from '../../lib/apiClient'
import Sidebar from '../Layout/Sidebar'
import TopBar from '../Layout/TopBar'
import UploadPanel from './UploadPanel'
import DocumentChips from './DocumentChips'
import QueryPanel from './QueryPanel'
import PdfViewerPane from './PdfViewerPane'

export default function Dashboard() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [documents, setDocuments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [documentsError, setDocumentsError] = useState('')

  const [chatKey, setChatKey] = useState(0)
  const [initialTurn, setInitialTurn] = useState(null)
  const [activeCitation, setActiveCitation] = useState(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pdfPaneOpen, setPdfPaneOpen] = useState(false)

  const PDF_PANE_MIN = 320
  const PDF_PANE_MAX = 900
  const [pdfPaneWidth, setPdfPaneWidth] = useState(420)
  const resizeStateRef = useRef(null)
  const [isResizingPane, setIsResizingPane] = useState(false)

  const handlePaneResizeStart = (e) => {
    resizeStateRef.current = { startX: e.clientX, startWidth: pdfPaneWidth }
    setIsResizingPane(true)
  }

  const handlePaneResizeMove = useCallback((e) => {
    if (!resizeStateRef.current) return
    const delta = resizeStateRef.current.startX - e.clientX
    const nextWidth = Math.min(
      PDF_PANE_MAX,
      Math.max(PDF_PANE_MIN, resizeStateRef.current.startWidth + delta),
    )
    setPdfPaneWidth(nextWidth)
  }, [])

  const handlePaneResizeEnd = useCallback(() => {
    resizeStateRef.current = null
    setIsResizingPane(false)
  }, [])

  useEffect(() => {
    if (!isResizingPane) return undefined
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handlePaneResizeMove)
    window.addEventListener('mouseup', handlePaneResizeEnd)
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handlePaneResizeMove)
      window.removeEventListener('mouseup', handlePaneResizeEnd)
    }
  }, [isResizingPane, handlePaneResizeMove, handlePaneResizeEnd])

  useEffect(() => {
    let active = true

    async function loadDocuments() {
      setLoadingDocuments(true)
      setDocumentsError('')

      try {
        const { data } = await api.get('/documents')
        if (!active) return

        const savedDocuments = data.map(document => ({
          ...document,
          document_id: document.id,
        }))
        setDocuments(currentDocuments => [
          ...currentDocuments,
          ...savedDocuments.filter(savedDocument => (
            !currentDocuments.some(document => document.document_id === savedDocument.document_id)
          )),
        ])
        setSelectedId(currentSelectedId => currentSelectedId || savedDocuments[0]?.document_id || '')
      } catch {
        if (active) {
          setDocumentsError('Unable to load saved documents. Please refresh the page.')
        }
      } finally {
        if (active) setLoadingDocuments(false)
      }
    }

    loadDocuments()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!loadingDocuments && documents.length === 0) setUploadOpen(true)
  }, [loadingDocuments, documents.length])

  const resetChat = () => {
    setInitialTurn(null)
    setActiveCitation(null)
    setChatKey(k => k + 1)
    setSidebarOpen(false)
  }

  const handleUploadComplete = (uploadedDocument) => {
    setDocuments(currentDocuments => [
      uploadedDocument,
      ...currentDocuments.filter(document => document.document_id !== uploadedDocument.document_id),
    ])
    setSelectedId(uploadedDocument.document_id)
    setUploadOpen(false)
    resetChat()
  }

  const handleSelectDocument = (documentId) => {
    setSelectedId(documentId)
    resetChat()
  }

  const handleSelectHistory = (log) => {
    setSelectedId(log.document_id)
    setInitialTurn({ question: log.question, answer: log.answer, sources: log.sources ?? [] })
    setActiveCitation(null)
    setChatKey(k => k + 1)
    setSidebarOpen(false)
  }

  const handleDeleteDocument = async (document) => {
    if (!window.confirm(`Delete "${document.filename}"? This can't be undone.`)) return

    try {
      await api.delete(`/documents/${document.document_id}`)
    } catch (err) {
      window.alert('Failed to delete document: ' + (err.response?.data?.detail ?? err.message))
      return
    }

    setDocuments(currentDocuments => {
      const remaining = currentDocuments.filter(d => d.document_id !== document.document_id)
      if (selectedId === document.document_id) {
        setSelectedId(remaining[0]?.document_id ?? '')
        setInitialTurn(null)
        setActiveCitation(null)
        setChatKey(k => k + 1)
      }
      return remaining
    })
  }

  const handleCitationClick = (source, index) => {
    if (typeof source.page !== 'number') return
    setActiveCitation({ page: source.page, text: source.text, index: index + 1, nonce: Date.now() })
    setPdfPaneOpen(true)
  }

  const currentDocument = documents.find(document => document.document_id === selectedId) ?? null

  return (
    <div className='flex h-screen flex-col bg-cream text-ink dark:bg-slate-950 dark:text-slate-100'>
      {/* grid-rows-1 = grid-template-rows: minmax(0,1fr): pins the single row to
          the viewport height so the panes' own overflow-y-auto regions scroll
          instead of the whole column growing past the fold (which clipped the
          composer). */}
      <div
        className='grid grid-rows-1 flex-1 overflow-hidden xl:grid-cols-[280px_1fr_auto_var(--pdf-pane-width)]'
        style={{ '--pdf-pane-width': `${pdfPaneWidth}px` }}
      >
        <div
          className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 xl:static xl:z-auto xl:w-auto xl:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            documents={documents}
            selectedId={selectedId}
            onSelectDocument={handleSelectDocument}
            loadingDocuments={loadingDocuments}
            documentsError={documentsError}
            onNewInquiry={resetChat}
            onSelectHistory={handleSelectHistory}
            onUploadClick={() => setUploadOpen(true)}
            onDeleteDocument={handleDeleteDocument}
          />
        </div>
        {sidebarOpen && (
          <div className='fixed inset-0 z-30 bg-black/40 xl:hidden' onClick={() => setSidebarOpen(false)} />
        )}

        <div className='flex min-h-0 min-w-0 flex-col overflow-hidden'>
          <TopBar
            title={currentDocument ? `Ask about ${currentDocument.filename}` : 'Ask a question'}
            status={loadingDocuments ? 'Loading your documents...' : undefined}
            email={user?.email}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSignOut={() => supabase.auth.signOut()}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          {currentDocument && (
            <div className='border-b border-black/[0.06] px-4 py-1.5 xl:hidden dark:border-slate-700'>
              <button
                type='button'
                onClick={() => setPdfPaneOpen(true)}
                className='text-xs font-medium text-forest hover:underline dark:text-forest-light'
              >
                View source PDF
              </button>
            </div>
          )}

          {uploadOpen && (
            <div className='relative border-b border-black/[0.06] p-4 dark:border-slate-700'>
              <button
                type='button'
                onClick={() => setUploadOpen(false)}
                className='absolute right-3 top-3 z-10 rounded-md p-1 text-ink-muted hover:bg-black/5 dark:text-slate-400 dark:hover:bg-slate-800'
                aria-label='Close upload panel'
              >
                <X size={16} />
              </button>
              <UploadPanel onUploadComplete={handleUploadComplete} />
            </div>
          )}

          <DocumentChips documents={documents} selectedId={selectedId} onChange={handleSelectDocument} />

          <div className='flex min-h-0 flex-1 flex-col'>
            <QueryPanel
              key={`${currentDocument?.document_id}-${chatKey}`}
              document={currentDocument}
              initialTurn={initialTurn}
              onCitationClick={handleCitationClick}
            />
          </div>
        </div>

        <div
          onMouseDown={handlePaneResizeStart}
          className={`hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-black/[0.06] hover:bg-forest/40 xl:flex dark:bg-slate-700 dark:hover:bg-forest-light/40 ${
            isResizingPane ? 'bg-forest/50 dark:bg-forest-light/50' : ''
          }`}
          role='separator'
          aria-orientation='vertical'
          aria-label='Resize PDF pane'
        >
          <div className='h-8 w-0.5 rounded-full bg-black/20 dark:bg-white/20' />
        </div>

        <div
          className={`fixed inset-y-0 right-0 z-40 w-full max-w-md transform border-l border-black/[0.06] transition-transform duration-200 xl:static xl:z-auto xl:w-auto xl:max-w-none xl:translate-x-0 dark:border-slate-700 ${
            pdfPaneOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <PdfViewerPane
            selectedDocument={currentDocument}
            activeCitation={activeCitation}
            onClose={() => setPdfPaneOpen(false)}
          />
        </div>
        {pdfPaneOpen && (
          <div className='fixed inset-0 z-30 bg-black/40 xl:hidden' onClick={() => setPdfPaneOpen(false)} />
        )}
      </div>
    </div>
  )
}
