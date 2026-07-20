// frontend/src/components/Dashboard/QueryPanel.jsx
// Question input + answer
import { useState } from 'react'
import api from '../../lib/apiClient'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import SourceChunks from './SourceChunks'

export default function QueryPanel({ document }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAsk = async (e) => {
    e.preventDefault()
    if (!question.trim() || !document) return
    setLoading(true); setError(''); setAnswer(''); setSources([])

    try {
      const { data } = await api.post('/query', {
        question,
        document_id: document.document_id,
        collection_name: document.collection_name
      })
      setAnswer(data.answer)
      setSources(data.sources)
    } catch (err) {
      setError('Query failed: ' + (err.response?.data?.detail ?? err.message))
    } finally {
      setLoading(false)
    }
  }

  if (!document) {
    return (
      <div className='border-2 border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400'>
        Upload a PDF first to start asking questions.
      </div>
    )
  }

  return (
    <div className='border border-slate-200 rounded-lg p-6 space-y-4'>
      <h2 className='font-semibold text-lg'>Ask a Question</h2>
      <p className='text-sm text-slate-500'>Document: {document.filename ?? document.collection_name}</p>
      <form onSubmit={handleAsk} className='flex gap-2'>
        <Input
          placeholder='What does this document say about...?'
          value={question}
          onChange={e => setQuestion(e.target.value)}
          required
        />
        <Button type='submit' disabled={loading}>
          {loading ? 'Thinking...' : 'Ask'}
        </Button>
      </form>
      {error && <p className='text-red-500 text-sm'>{error}</p>}
      {answer && (
        <div className='bg-slate-50 border border-slate-200 rounded-md p-4'>
          <p className='text-sm whitespace-pre-wrap'>{answer}</p>
        </div>
      )}
      <SourceChunks sources={sources} />
    </div>
  )
}
