// frontend/src/components/Dashboard/UploadPanel.jsx
import { useState, useRef } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import api from '../../lib/apiClient'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'

export default function UploadPanel({ onUploadComplete }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const inputRef = useRef()

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setProgress(10)
    setStatus('Reading PDF...')

    const formData = new FormData()
    formData.append('file', file)

    try {
      setProgress(40); setStatus('Splitting into chunks...')
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setProgress(90); setStatus('Embedding vectors...')
      setTimeout(() => {
        setProgress(100)
        setStatus(`Done! ${data.chunk_count} chunks indexed.`)
        setUploading(false)
        onUploadComplete(data)  // Pass document info to parent
      }, 800)
    } catch (err) {
      setStatus('Upload failed: ' + err.response?.data?.detail)
      setUploading(false)
    }
  }

  return (
    <div className='space-y-4 rounded-2xl border border-black/[0.08] bg-cream-panel p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900'>
      <h2 className='font-serif text-lg text-ink dark:text-slate-100'>Add a document</h2>
      <button
        type='button'
        onClick={() => inputRef.current.click()}
        className='flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/15 px-6 py-8 text-center transition-colors hover:border-forest/50 hover:bg-forest/[0.04] dark:border-slate-700 dark:hover:border-forest-light/50'
      >
        <span className='flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 text-forest dark:bg-forest/20 dark:text-forest-light'>
          {file ? <FileText size={18} /> : <UploadCloud size={18} />}
        </span>
        <span className='text-sm font-medium text-ink dark:text-slate-200'>
          {file ? file.name : 'Click to choose a PDF'}
        </span>
        {!file && <span className='text-xs text-ink-muted dark:text-slate-500'>PDF files only</span>}
      </button>
      <input ref={inputRef} type='file' accept='.pdf' className='hidden'
        onChange={e => setFile(e.target.files[0])} />
      {file && !uploading && (
        <Button onClick={handleUpload} className='w-full'>
          Index document
        </Button>
      )}
      {uploading && <Progress value={progress} className='w-full' />}
      {status && <p className='text-sm text-ink-soft dark:text-slate-300'>{status}</p>}
    </div>
  )
}
