// frontend/src/components/Dashboard/Dashboard.jsx
// Main protected route — AppShell owns the sidebar/chat/PDF split; this
// component owns all cross-pane state (library, conversations, preferences).
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import api from '../../lib/apiClient'
import UploadPanel from './UploadPanel'
import ChatPane from './ChatPane'
import ManageDocumentsDialog from './ManageDocumentsDialog'
import SettingsPanel from './SettingsPanel'
import AppShell from '../Workspace/AppShell'
import { loadWorkspacePreferences, saveWorkspacePreferences, toggleSelection } from '../Workspace/workspaceState'

const PdfViewer = lazy(() => import('./PdfViewerPane'))

const DEFAULT_SETTINGS = { citationPlacement: 'inline', answerStyle: 'balanced' }

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('zero-cost-scholar.settings')) || { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export default function Dashboard({ user, onSignOut }) {
  const [documents, setDocuments] = useState([])
  const [conversations, setConversations] = useState([])
  const [preferences, setPreferences] = useState(loadWorkspacePreferences)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [activeCitation, setActiveCitation] = useState(null)
  const [selectedPdfText, setSelectedPdfText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [activeDocumentId, setActiveDocumentId] = useState(null)
  // Retrieval stage, surfaced by the chat pane so the top bar can report it.
  const [stage, setStage] = useState('')

  const toggleDocument = useCallback(id => {
    setPreferences(current => ({ ...current, selectedDocumentIds: toggleSelection(current.selectedDocumentIds, id) }))
  }, [])

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
          const selected = restored.length ? restored : savedDocuments[0] ? [savedDocuments[0].document_id] : []
          setActiveDocumentId(selected[0] || null)
          return { ...current, selectedDocumentIds: selected }
        })
      } catch {
        if (active) setError('Unable to load your workspace. Refresh to try again.')
      }
    }
    loadWorkspace()
    return () => { active = false }
  }, [])

  useEffect(() => { saveWorkspacePreferences(preferences) }, [preferences])
  useEffect(() => { localStorage.setItem('zero-cost-scholar.settings', JSON.stringify(settings)) }, [settings])

  const handleUploadComplete = async (uploadedDocument) => {
    setDocuments(currentDocuments => [
      uploadedDocument,
      ...currentDocuments.filter(document => document.document_id !== uploadedDocument.document_id),
    ])
    setPreferences(current => ({ ...current, selectedDocumentIds: [uploadedDocument.document_id] }))
    try {
      const { data } = await api.post(`/documents/${uploadedDocument.document_id}/summary`)
      setDocuments(current => current.map(document => document.document_id === uploadedDocument.document_id ? { ...document, summary: data.summary } : document))
    } catch { setError('The PDF is ready, but its automatic summary could not be generated.') }
  }

  const selectedDocuments = documents.filter(document => preferences.selectedDocumentIds.includes(document.document_id))
  const activeDocument = documents.find(document => document.document_id === activeDocumentId) || selectedDocuments[0] || null

  const newConversation = () => {
    setMessages([])
    setActiveCitation(null)
    setActiveDocumentId(null)
    setPreferences(current => ({ ...current, conversationId: null, selectedDocumentIds: [] }))
    return null
  }

  const ensureConversation = async (question) => {
    const documentIds = preferences.selectedDocumentIds
    if (!documentIds.length) return null
    const title = question.trim().slice(0, 48) || 'New inquiry'
    const now = new Date().toISOString()
    const { data } = await api.post('/conversations', {
      document_ids: documentIds,
      title,
    })
    const conversation = {
      ...data,
      title: data.title?.trim() || title,
      document_ids: data.document_ids || documentIds,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    }
    setConversations(current => [conversation, ...current.filter(item => item.id !== conversation.id)])
    setPreferences(current => ({ ...current, conversationId: conversation.id, selectedDocumentIds: documentIds }))
    return conversation.id
  }

  const selectConversation = async (id) => {
    const conversation = conversations.find(item => item.id === id)
    const { data } = await api.get(`/conversations/${id}/messages`)
    setMessages(data)
    setActiveCitation(null)
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
      setActiveDocumentId(citedDocument.document_id)
      setPreferences(current => ({ ...current, mobilePane: 'pdf' }))
      setActiveCitation(citation)
    }
  }

  return (
    <>
      <AppShell
        documents={documents}
        conversations={conversations}
        selectedDocumentIds={preferences.selectedDocumentIds}
        activeConversationId={preferences.conversationId}
        mobilePane={preferences.mobilePane}
        theme={preferences.theme}
        status={stage}
        onToggleDocument={toggleDocument}
        onMobilePaneChange={mobilePane => setPreferences(current => ({ ...current, mobilePane }))}
        onThemeChange={theme => setPreferences(current => ({ ...current, theme }))}
        onSelectConversation={selectConversation}
        onSelectDocument={id => setActiveDocumentId(id)}
        onPinConversation={pinConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onNewConversation={newConversation}
        onManageDocuments={() => setManageOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        user={user}
        onSignOut={onSignOut}
      >
        <div className='chat-pane-content'>
          {error && <p role='alert' className='workspace-error workspace-banner'>{error}</p>}
          {!documents.length && (
            <div className='workspace-empty'>
              <span className='kicker'>Evidence-grounded research</span>
              <h1>Read closely. Ask confidently.</h1>
              <p>Upload a PDF to begin. Every answer stays connected to its evidence.</p>
              <UploadPanel onUploadComplete={handleUploadComplete} />
            </div>
          )}
          {documents.length > 0 && (
            <ChatPane
              documentIds={preferences.selectedDocumentIds}
              documents={selectedDocuments}
              conversationId={preferences.conversationId}
              onEnsureConversation={ensureConversation}
              initialMessages={messages}
              selectedPdfText={selectedPdfText}
              citationPlacement={settings.citationPlacement}
              answerStyle={settings.answerStyle}
              summary={activeDocument?.summary}
              onCitationClick={openCitation}
              onRemoveDocument={toggleDocument}
              onStageChange={setStage}
              onClearSelectedText={() => setSelectedPdfText('')}
            />
          )}
        </div>
        <Suspense fallback={<div className='pdf-empty'><p>Opening reader…</p></div>}>
          <PdfViewer
            selectedDocument={documents.find(document => document.document_id === activeCitation?.document_id) || activeDocument}
            documents={documents}
            onSelectDocument={setActiveDocumentId}
            activeCitation={activeCitation}
            onTextSelection={setSelectedPdfText}
            onClose={activeCitation ? () => setActiveCitation(null) : undefined}
          />
        </Suspense>
      </AppShell>
      <ManageDocumentsDialog
        open={manageOpen}
        documents={documents}
        selectedDocumentIds={preferences.selectedDocumentIds}
        onToggleDocument={toggleDocument}
        onUploadComplete={handleUploadComplete}
        onClose={() => setManageOpen(false)}
      />
      <SettingsPanel open={settingsOpen} settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
