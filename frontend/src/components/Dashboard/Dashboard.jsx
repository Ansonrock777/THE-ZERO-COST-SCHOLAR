// frontend/src/components/Dashboard/Dashboard.jsx
// Main protected route
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabaseClient'
import api from '../../lib/apiClient'
import { Button } from '../ui/button'
import UploadPanel from './UploadPanel'
import DocumentSelector from './DocumentSelector'
import QueryPanel from './QueryPanel'
import HistoryPanel from './HistoryPanel'

export default function Dashboard() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [documentsError, setDocumentsError] = useState('')

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

  const handleUploadComplete = (uploadedDocument) => {
    setDocuments(currentDocuments => [
      uploadedDocument,
      ...currentDocuments.filter(document => document.document_id !== uploadedDocument.document_id),
    ])
    setSelectedId(uploadedDocument.document_id)
  }

  const currentDocument = documents.find(document => document.document_id === selectedId) ?? null

  return (
    <div className='min-h-screen bg-slate-50'>
      <header className='border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between'>
        <h1 className='font-bold text-lg'>The Zero-Cost Scholar</h1>
        <div className='flex items-center gap-4 text-sm text-slate-500'>
          <span>{user?.email}</span>
          <Button className='bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            onClick={() => supabase.auth.signOut()}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className='max-w-3xl mx-auto p-6 space-y-6'>
        <UploadPanel onUploadComplete={handleUploadComplete} />
        <DocumentSelector
          documents={documents}
          selectedId={selectedId}
          onChange={setSelectedId}
          loading={loadingDocuments}
          error={documentsError}
        />
        <QueryPanel key={currentDocument?.document_id} document={currentDocument} />
        <HistoryPanel />
      </main>
    </div>
  )
}
