import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/apiClient'

export default function DeveloperDashboard() {
  const [data, setData] = useState({ aggregates: {}, traces: [] })
  const [error, setError] = useState('')
  useEffect(() => { api.get('/developer/telemetry').then(response => setData(response.data)).catch(() => setError('Developer telemetry is unavailable. Enable DEV_MODE on the backend.')) }, [])
  const preferred = ['total_ms', 'vector_retrieval_ms', 'bm25_retrieval_ms', 'generation_ms', 'prompt_tokens', 'vector_candidates', 'context_chunks']
  return <main className='developer-dashboard'>
    <header><div><span className='workspace-kicker'>Local diagnostics</span><h1>Pipeline telemetry</h1></div><Link to='/dashboard'>Back to reader</Link></header>
    {error && <p role='alert' className='workspace-error'>{error}</p>}
    <aside className='evaluation-note'><strong>Evaluation guardrail</strong><p>Deterministic retrieval checks notify on document recall, reciprocal rank, page accuracy, and term coverage regressions. RAGAS remains deferred until a trustworthy free judge is available.</p></aside>
    <section className='metric-grid'>{preferred.filter(name => data.aggregates[name]).map(name => <article key={name}><span>{name.replaceAll('_', ' ')}</span><strong>{Math.round(data.aggregates[name].average * 10) / 10}</strong><small>p95 {Math.round(data.aggregates[name].p95 * 10) / 10} · {data.aggregates[name].count} traces</small></article>)}</section>
    <section className='trace-table'><h2>Recent traces</h2><div role='table'>{data.traces.map(trace => <div role='row' key={trace.trace_id}><code>{trace.trace_id}</code><span>{trace.status}</span><span>{trace.document_count} docs</span><span>{Math.round(trace.metrics.total_ms || 0)} ms</span></div>)}</div></section>
  </main>
}
