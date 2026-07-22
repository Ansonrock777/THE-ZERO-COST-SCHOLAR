import { useEffect, useRef, useState } from 'react'
import { Copy, RotateCcw, Send, Square } from 'lucide-react'
import FormattedAnswer from './FormattedAnswer'
import { streamQuery } from '../../lib/queryStream'

const STAGE_LABELS = { validating: 'Checking your request', retrieving: 'Finding evidence', generating: 'Writing the answer' }
const EMPTY_MESSAGES = []

export default function ChatPane({ documentIds, conversationId, initialMessages = EMPTY_MESSAGES, selectedPdfText = '', citationPlacement = 'inline', answerStyle = 'balanced', summary = '', onEnsureConversation, onCitationClick }) {
  const [messages, setMessages] = useState(initialMessages)
  const [question, setQuestion] = useState('')
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const lastQuestion = useRef('')
  useEffect(() => { setMessages(initialMessages) }, [initialMessages, conversationId])

  const ask = async (nextQuestion = question) => {
    const clean = nextQuestion.trim()
    if (!clean || !documentIds.length || stage) return
    const controller = new AbortController()
    abortRef.current = controller
    lastQuestion.current = clean
    setQuestion('')
    setError('')
    setMessages(current => [...current, { role: 'user', content: clean }])
    setStage('validating')
    try {
      const activeConversationId = conversationId || await onEnsureConversation?.()
      await streamQuery({ question: clean, document_ids: documentIds, conversation_id: activeConversationId || undefined, answer_style: answerStyle }, {
        signal: controller.signal,
        onEvent: event => {
          if (event.type === 'status') setStage(event.stage)
          if (event.type === 'error') throw new Error(event.detail)
          if (event.type === 'result') {
            setMessages(current => [...current, { role: 'assistant', content: event.answer, sources: event.sources, trace_id: event.trace_id }])
            setStage('')
          }
        },
      })
    } catch (requestError) {
      setStage('')
      if (requestError.name !== 'AbortError') setError(requestError.message || 'The query failed.')
    }
  }

  const contextualPrompt = selectedPdfText ? `Regarding this selected passage:\n“${selectedPdfText}”\n\n` : ''

  return (
    <div className='chat-workspace'>
      <div className='message-list' aria-live='polite'>
        {messages.length === 0 && (
          <div className='chat-intro'>
            <span className='workspace-kicker'>New inquiry</span>
            <h1>What would you like to understand?</h1>
            <p>Answers combine semantic and BM25 retrieval, then link back to the original pages.</p>
            {summary && <aside className='document-summary'><strong>Document overview</strong><p>{summary}</p></aside>}
          </div>
        )}
        {messages.map((message, index) => (
          <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
            <span className='message-role'>{message.role === 'assistant' ? 'Scholar' : 'You'}</span>
            <FormattedAnswer text={message.content} sources={message.sources} citationPlacement={citationPlacement} onCitationClick={onCitationClick} />
            {message.role === 'assistant' && (
              <button type='button' className='message-action' aria-label='Copy answer' onClick={() => navigator.clipboard.writeText(message.content)}><Copy size={14} /> Copy</button>
            )}
          </article>
        ))}
        {stage && <div className='pipeline-status'><span className='status-pulse' />{STAGE_LABELS[stage] || stage}</div>}
        {error && <p className='workspace-error' role='alert'>{error}</p>}
      </div>
      <form className='composer' onSubmit={event => { event.preventDefault(); ask(contextualPrompt + question) }}>
        {selectedPdfText && <div className='selection-context'>Asking about selected PDF text</div>}
        <textarea aria-label='Ask a question' value={question} maxLength={4000} rows={3} placeholder={documentIds.length ? 'Ask across the selected documents…' : 'Select a document first'} onChange={event => setQuestion(event.target.value)} disabled={!documentIds.length} />
        <div className='composer-actions'>
          {lastQuestion.current && !stage && <button type='button' className='quiet-button' onClick={() => ask(lastQuestion.current)}><RotateCcw size={15} /> Retry</button>}
          {stage ? <button type='button' className='send-button stop' onClick={() => abortRef.current?.abort()}><Square size={14} /> Stop</button> : <button type='submit' className='send-button' disabled={!question.trim()}><Send size={15} /> Ask</button>}
        </div>
      </form>
    </div>
  )
}
