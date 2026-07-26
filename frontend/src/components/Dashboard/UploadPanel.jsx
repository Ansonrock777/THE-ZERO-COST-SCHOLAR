// frontend/src/components/Dashboard/UploadPanel.jsx
import { useRef, useState } from 'react'
import { CloudUpload, FileText } from 'lucide-react'
import api from '../../lib/apiClient'
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
    setStatus('Reading PDF…')

    const formData = new FormData()
    formData.append('file', file)

    try {
      setProgress(40); setStatus('Splitting into chunks…')
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProgress(100)
      setStatus(`Done — ${data.chunk_count} chunks indexed.`)
      setUploading(false)
      onUploadComplete?.(data)
    } catch (err) {
      setStatus('Upload failed: ' + (err.response?.data?.detail || err.message))
      setUploading(false)
    }
  }

  return (
    <div className='upload-panel'>
      <h2 className='card-title'>Add a document</h2>
      <button type='button' className='upload-dropzone' onClick={() => inputRef.current.click()}>
        <span className='upload-mark' aria-hidden='true'>
          {file ? <FileText size={18} strokeWidth={1.7} /> : <CloudUpload size={18} strokeWidth={1.7} />}
        </span>
        <span className='upload-label'>{file ? file.name : 'Click to choose a PDF'}</span>
        {!file && <span className='upload-hint'>PDF files only</span>}
      </button>
      <input
        ref={inputRef}
        type='file'
        accept='.pdf'
        className='sr-only'
        aria-label='Choose a PDF to index'
        onChange={event => setFile(event.target.files[0])}
      />
      {file && !uploading && (
        <button type='button' className='btn btn-primary btn-block' onClick={handleUpload}>Index document</button>
      )}
      {uploading && <Progress value={progress} />}
      {status && <p className='upload-status'>{status}</p>}
    </div>
  )
}
