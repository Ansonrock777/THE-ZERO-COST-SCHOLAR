// frontend/src/components/Dashboard/QueryPanel.jsx
// Question input + answer, rendered as a chat-style thread. `initialTurn`
// (from a clicked History entry) lazily seeds the state on mount — the
// parent forces a remount via a key change when replaying history, so this
// stays a plain lazy useState instead of a sync-on-prop-change effect.
import { useState } from 'react'
import { Landmark, Send, BadgeCheck, BookOpen } from 'lucide-react'
import api from '../../lib/apiClient'
import SourceChunks from './SourceChunks'
import FormattedAnswer from './FormattedAnswer'

export function createQueryPayload(question, document) {
  return { question, document_id: document.document_id }
}

export default function QueryPanel({ document, initialTurn, onCitationClick = () => {} }) {
  const [question, setQuestion] = useState(initialTurn?.question ?? '')
  const [answer, setAnswer] = useState(initialTurn?.answer ?? '')
  const [sources, setSources] = useState(initialTurn?.sources ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAsk = async (e) => {
    e.preventDefault()
    if (!question.trim() || !document) return
    setLoading(true); setError(''); setAnswer(''); setSources([])

    try {
      const { data } = await api.post('/query', createQueryPayload(question, document))
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
      <div className='flex h-full items-center justify-center p-6'>
        <div className='max-w-sm rounded-2xl border border-dashed border-black/15 bg-cream-panel/60 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40'>
          <span className='mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest dark:bg-forest/20 dark:text-forest-light'>
            <BookOpen size={20} />
          </span>
          <p className='font-serif text-lg text-ink dark:text-slate-100'>Your reading room is empty</p>
          <p className='mt-1 text-sm text-ink-muted dark:text-slate-400'>
            Upload a PDF to start asking questions about it.
          </p>
        </div>
      </div>
    )
  }

  const isEmpty = !question && !answer && !loading

  return (
    <div className='flex h-full flex-col'>
      <div className='scrollbar-slim flex-1 overflow-y-auto px-4 py-6 md:px-6'>
        <div className='mx-auto w-full max-w-3xl space-y-6'>
          <p className='text-center text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted dark:text-slate-500'>
            {document.filename ?? 'Selected document'}
          </p>

          {isEmpty && (
            <div className='pt-10 text-center'>
              <span className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest dark:bg-forest/20 dark:text-forest-light'>
                <Landmark size={22} />
              </span>
              <p className='font-serif text-xl text-ink dark:text-slate-100'>Ask this document anything</p>
              <p className='mx-auto mt-2 max-w-md text-sm text-ink-muted dark:text-slate-400'>
                Every answer is drawn from the pages themselves — and cites exactly where it came from.
              </p>
            </div>
          )}

          {question && (
            <div className='flex justify-end'>
              <div className='max-w-xl rounded-2xl rounded-tr-md bg-navy-900 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm'>
                {question}
              </div>
            </div>
          )}

          {error && (
            <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'>
              {error}
            </div>
          )}

          {loading && (
            <div className='flex items-start gap-3'>
              <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm'>
                <Landmark size={15} />
              </span>
              <div className='rounded-2xl rounded-tl-md border border-black/[0.06] bg-cream-panel px-4 py-3 text-sm text-ink-muted shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'>
                <span className='inline-flex items-center gap-1.5'>
                  Consulting your sources
                  <span className='inline-flex gap-0.5'>
                    <span className='h-1 w-1 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]' />
                    <span className='h-1 w-1 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]' />
                    <span className='h-1 w-1 animate-bounce rounded-full bg-ink-muted' />
                  </span>
                </span>
              </div>
            </div>
          )}

          {answer && !loading && (
            <div className='flex items-start gap-3'>
              <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm'>
                <Landmark size={15} />
              </span>
              <div className='min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-md border border-black/[0.06] bg-cream-panel p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900'>
                <div className='flex items-center gap-2 border-b border-black/[0.06] pb-3 dark:border-slate-700/60'>
                  <BadgeCheck size={16} className='text-forest dark:text-forest-light' />
                  <p className='font-serif text-base font-medium text-ink dark:text-slate-100'>
                    Verified from your sources
                  </p>
                </div>
                <div className='text-[15px] leading-relaxed text-ink-soft dark:text-slate-200'>
                  <FormattedAnswer text={answer} sources={sources} onCitationClick={onCitationClick} />
                </div>
                <SourceChunks sources={sources} onCitationClick={onCitationClick} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='border-t border-black/[0.06] bg-cream/60 px-4 py-4 md:px-6 dark:border-slate-700/60 dark:bg-slate-950/40'>
        <form onSubmit={handleAsk} className='mx-auto w-full max-w-3xl'>
          <div className='flex items-center gap-2 rounded-2xl border border-black/10 bg-cream-panel p-1.5 pl-4 shadow-sm transition-colors focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/15 dark:border-slate-700 dark:bg-slate-900'>
            <input
              placeholder='What does this document say about…?'
              value={question}
              onChange={e => setQuestion(e.target.value)}
              required
              className='min-w-0 flex-1 bg-transparent py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500'
            />
            <button
              type='submit'
              disabled={loading || !question.trim()}
              aria-label='Ask'
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white shadow-sm transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 focus-visible:ring-offset-cream-panel'
            >
              <Send size={16} />
            </button>
          </div>
          <p className='mt-2 text-center text-[11px] text-ink-muted dark:text-slate-500'>
            Answers are grounded in this document and cite the page they came from.
          </p>
        </form>
      </div>
    </div>
  )
}
