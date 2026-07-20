// frontend/src/components/Dashboard/Dashboard.jsx
// Main protected route
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '../ui/button'
import UploadPanel from './UploadPanel'
import QueryPanel from './QueryPanel'
import HistoryPanel from './HistoryPanel'

export default function Dashboard() {
  const { user } = useAuth()
  const [currentDocument, setCurrentDocument] = useState(null)

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
        <UploadPanel onUploadComplete={setCurrentDocument} />
        <QueryPanel document={currentDocument} />
        <HistoryPanel />
      </main>
    </div>
  )
}
