// frontend/src/components/Dashboard/HistoryPanel.jsx
// Past queries — loaded from the backend /history endpoint on mount
import { useState, useEffect } from 'react'
import api from '../../lib/apiClient'
import { stripMarkdown } from './FormattedAnswer'

export default function HistoryPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/history')
      .then(({ data }) => setLogs(data))
      .catch(err => setError('Failed to load history: ' + (err.response?.data?.detail ?? err.message)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className='text-sm text-slate-400'>Loading history...</p>
  if (error) return <p className='text-sm text-red-500'>{error}</p>
  if (logs.length === 0) return <p className='text-sm text-slate-400'>No queries yet.</p>

  return (
    <div className='space-y-3'>
      <h2 className='font-semibold text-lg'>Query History</h2>
      {logs.map((log) => (
        <div key={log.id} className='border border-slate-200 rounded-md p-3'>
          <p className='text-xs text-slate-400'>
            {log.user_documents?.filename ?? 'Unknown document'} · {new Date(log.created_at).toLocaleString()}
          </p>
          <p className='text-sm font-medium mt-1'>{log.question}</p>
          <p className='text-sm text-slate-600 mt-1 line-clamp-2'>{stripMarkdown(log.answer)}</p>
        </div>
      ))}
    </div>
  )
}
