// frontend/src/components/Dashboard/HistoryPanel.jsx
// Sidebar's dated inquiry history — loaded from the backend /history
// endpoint on mount. `searchTerm` filters client-side (no new endpoint);
// clicking an entry replays that Q&A into the chat panel.
import { useState, useEffect } from 'react'
import api from '../../lib/apiClient'

function dateLabel(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Assumes `logs` is already sorted newest-first (as /history returns it), so
// groups come out in the same newest-first order — Today, Yesterday, ...
export function groupLogsByDate(logs) {
  const groups = []
  for (const log of logs) {
    const label = dateLabel(log.created_at)
    let group = groups.find(candidate => candidate.label === label)
    if (!group) {
      group = { label, logs: [] }
      groups.push(group)
    }
    group.logs.push(log)
  }
  return groups
}

export default function HistoryPanel({ searchTerm = '', onSelectHistory = () => {} }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/history')
      .then(({ data }) => setLogs(data))
      .catch(err => setError('Failed to load history: ' + (err.response?.data?.detail ?? err.message)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className='px-3 text-sm text-slate-400'>Loading history...</p>
  if (error) return <p className='px-3 text-sm text-red-400'>{error}</p>
  if (logs.length === 0) return <p className='px-3 text-sm text-slate-400'>No queries yet.</p>

  const trimmedSearch = searchTerm.trim().toLowerCase()
  const filtered = trimmedSearch
    ? logs.filter(log => log.question.toLowerCase().includes(trimmedSearch))
    : logs

  if (filtered.length === 0) {
    return <p className='px-3 text-sm text-slate-400'>No matching inquiries.</p>
  }

  return (
    <div className='space-y-4'>
      {groupLogsByDate(filtered).map(group => (
        <div key={group.label} className='space-y-1'>
          <p className='px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400'>{group.label}</p>
          <ul className='space-y-0.5'>
            {group.logs.map(log => (
              <li key={log.id}>
                <button
                  type='button'
                  onClick={() => onSelectHistory(log)}
                  className='block w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-navy-800/60'
                >
                  <p className='truncate text-sm text-slate-200'>{log.question}</p>
                  <p className='truncate text-xs text-slate-500'>
                    {log.user_documents?.filename ?? 'Unknown document'}
                    {' · '}
                    {new Date(log.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
