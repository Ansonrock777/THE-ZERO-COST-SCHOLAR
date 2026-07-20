// frontend/src/components/Dashboard/UploadPanel.jsx
import { useState, useRef } from 'react'
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
    <div className='border-2 border-dashed border-slate-200 rounded-lg p-6 space-y-4'>
      <h2 className='font-semibold text-lg'>Upload a PDF</h2>
      <div onClick={() => inputRef.current.click()}
        className='cursor-pointer text-center py-8 text-slate-400 hover:bg-slate-50 rounded-lg'>
        {file ? file.name : 'Click to choose a PDF file'}
      </div>
      <input ref={inputRef} type='file' accept='.pdf' className='hidden'
        onChange={e => setFile(e.target.files[0])} />
      {file && !uploading && (
        <Button onClick={handleUpload} className='w-full'>
          Index Document
        </Button>
      )}
      {uploading && <Progress value={progress} className='w-full' />}
      {status && <p className='text-sm text-slate-600'>{status}</p>}
    </div>
  )
}
