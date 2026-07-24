import { lazy, Suspense, useEffect, useState } from 'react'
import api from '../../lib/apiClient'
import UploadPanel from './UploadPanel'
import ChatPane from './ChatPane'
import SettingsPanel from './SettingsPanel'
import AppShell from '../Workspace/AppShell'
import { loadWorkspacePreferences, saveWorkspacePreferences, toggleSelection } from '../Workspace/workspaceState'

const PdfViewer = lazy(() => import('./PdfViewer'))

export default function Dashboard() {
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
  )
}
