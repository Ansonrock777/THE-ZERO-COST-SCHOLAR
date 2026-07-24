<<<<<<< HEAD
import { lazy, Suspense, useEffect, useState } from 'react'
import api from '../../lib/apiClient'
import UploadPanel from './UploadPanel'
import ChatPane from './ChatPane'
import SettingsPanel from './SettingsPanel'
import AppShell from '../Workspace/AppShell'
import { loadWorkspacePreferences, saveWorkspacePreferences, toggleSelection } from '../Workspace/workspaceState'

const PdfViewer = lazy(() => import('./PdfViewer'))

export default function Dashboard() {
=======
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

>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
  const [documents, setDocuments] = useState([])
  const [conversations, setConversations] = useState([])
  const [preferences, setPreferences] = useState(loadWorkspacePreferences)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [activeCitation, setActiveCitation] = useState(null)
  const [selectedPdfText, setSelectedPdfText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zero-cost-scholar.settings')) || { citationPlacement: 'inline', answerStyle: 'balanced' } } catch { return { citationPlacement: 'inline', answerStyle: 'balanced' } }
  })

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
    async function loadWorkspace() {
      try {
        const [{ data: documentData }, { data: conversationData }] = await Promise.all([
          api.get('/documents'), api.get('/conversations'),
        ])
        if (!active) return
        const savedDocuments = documentData.map(document => ({
          ...document,
          document_id: document.id,
        }))
        setDocuments(savedDocuments)
        setConversations(conversationData)
        setPreferences(current => {
          const available = new Set(savedDocuments.map(document => document.document_id))
          const restored = current.selectedDocumentIds.filter(id => available.has(id))
          return { ...current, selectedDocumentIds: restored.length ? restored : savedDocuments[0] ? [savedDocuments[0].document_id] : [] }
        })
      } catch {
        if (active) setError('Unable to load your workspace. Refresh to try again.')
      }
    }
    loadWorkspace()
    return () => { active = false }
  }, [])

<<<<<<< HEAD
  useEffect(() => { saveWorkspacePreferences(preferences) }, [preferences])
  useEffect(() => { localStorage.setItem('zero-cost-scholar.settings', JSON.stringify(settings)) }, [settings])

  const handleUploadComplete = async (uploadedDocument) => {
=======
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
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
    setDocuments(currentDocuments => [
      uploadedDocument,
      ...currentDocuments.filter(document => document.document_id !== uploadedDocument.document_id),
    ])
<<<<<<< HEAD
    setPreferences(current => ({ ...current, selectedDocumentIds: [uploadedDocument.document_id] }))
    try {
      const { data } = await api.post(`/documents/${uploadedDocument.document_id}/summary`)
      setDocuments(current => current.map(document => document.document_id === uploadedDocument.document_id ? { ...document, summary: data.summary } : document))
    } catch { setError('The PDF is ready, but its automatic summary could not be generated.') }
=======
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
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
  }

  const selectedDocuments = documents.filter(document => preferences.selectedDocumentIds.includes(document.document_id))
  const activeDocument = selectedDocuments[0] ?? null

  const newConversation = async () => {
    if (!preferences.selectedDocumentIds.length) return null
    const { data } = await api.post('/conversations', {
      document_ids: preferences.selectedDocumentIds,
      title: 'New inquiry',
    })
    setConversations(current => [data, ...current])
    setMessages([])
    setPreferences(current => ({ ...current, conversationId: data.id }))
    return data.id
  }

  const selectConversation = async (id) => {
    const conversation = conversations.find(item => item.id === id)
    const { data } = await api.get(`/conversations/${id}/messages`)
    setMessages(data)
    setPreferences(current => ({
      ...current,
      conversationId: id,
      selectedDocumentIds: conversation?.document_ids || current.selectedDocumentIds,
    }))
  }

  const pinConversation = async (conversation) => {
    await api.patch(`/conversations/${conversation.id}`, { pinned: !conversation.pinned })
    setConversations(current => current.map(item => item.id === conversation.id ? { ...item, pinned: !item.pinned } : item))
  }

  const deleteConversation = async (conversation) => {
    await api.delete(`/conversations/${conversation.id}`)
    setConversations(current => current.filter(item => item.id !== conversation.id))
    if (preferences.conversationId === conversation.id) {
      setMessages([])
      setPreferences(current => ({ ...current, conversationId: null }))
    }
  }

  const exportConversation = (conversation) => {
    const content = messages.map(message => `${message.role.toUpperCase()}\n${message.content}`).join('\n\n')
    const url = URL.createObjectURL(new Blob([`${conversation.title}\n\n${content}`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${conversation.title || 'inquiry'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renameConversation = async (conversation) => {
    const title = window.prompt('Rename inquiry', conversation.title)
    if (!title?.trim()) return
    await api.patch(`/conversations/${conversation.id}`, { title: title.trim() })
    setConversations(current => current.map(item => item.id === conversation.id ? { ...item, title: title.trim() } : item))
  }

  const openCitation = (citation) => {
    if (!citation) return
    const citedDocument = documents.find(document => document.document_id === citation.document_id)
    if (citedDocument) {
      setPreferences(current => ({ ...current, mobilePane: 'pdf' }))
      setActiveCitation(citation)
    }
  }

  return (
<<<<<<< HEAD
    <>
    <AppShell
      documents={documents}
      conversations={conversations}
      selectedDocumentIds={preferences.selectedDocumentIds}
      activeDocument={activeDocument}
      activeConversationId={preferences.conversationId}
      mobilePane={preferences.mobilePane}
      theme={preferences.theme}
      onToggleDocument={id => setPreferences(current => ({ ...current, selectedDocumentIds: toggleSelection(current.selectedDocumentIds, id) }))}
      onMobilePaneChange={mobilePane => setPreferences(current => ({ ...current, mobilePane }))}
      onThemeChange={theme => setPreferences(current => ({ ...current, theme }))}
      onNewConversation={newConversation}
      onSelectConversation={selectConversation}
      onPinConversation={pinConversation}
      onDeleteConversation={deleteConversation}
      onExportConversation={exportConversation}
      onRenameConversation={renameConversation}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      <div className='chat-pane-content'>
        {error && <p role='alert' className='workspace-error workspace-banner'>{error}</p>}
        {!documents.length && <div className='workspace-empty'><span className='workspace-kicker'>Evidence-grounded research</span><h1>Read closely. Ask confidently.</h1><p>Upload a PDF to begin. Every answer stays connected to its evidence.</p><UploadPanel onUploadComplete={handleUploadComplete} /></div>}
        {documents.length > 0 && <ChatPane documentIds={preferences.selectedDocumentIds} conversationId={preferences.conversationId} initialMessages={messages} selectedPdfText={selectedPdfText} citationPlacement={settings.citationPlacement} answerStyle={settings.answerStyle} summary={activeDocument?.summary} onEnsureConversation={newConversation} onCitationClick={openCitation} />}
      </div>
      <Suspense fallback={<div className='pdf-empty'><p>Opening reader…</p></div>}><PdfViewer document={documents.find(document => document.document_id === activeCitation?.document_id) || activeDocument} citation={activeCitation} onTextSelection={setSelectedPdfText} /></Suspense>
    </AppShell>
    <SettingsPanel open={settingsOpen} settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
    </>
=======
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
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
  )
}
