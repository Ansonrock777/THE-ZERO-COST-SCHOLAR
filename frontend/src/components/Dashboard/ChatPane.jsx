import { useEffect, useRef, useState } from 'react'
import { Copy, FileText, Landmark, Maximize2, Paperclip, RotateCcw, Send, Square, X } from 'lucide-react'
import FormattedAnswer from './FormattedAnswer'
import { streamQuery } from '../../lib/queryStream'

const STAGE_LABELS = { validating: 'Checking your request', retrieving: 'Finding evidence', generating: 'Writing the answer' }
const EMPTY_MESSAGES = []
const EMPTY_DOCUMENTS = []

function timeOf(message) {
  const value = message.created_at
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function ChatPane({
  documentIds,
  documents = EMPTY_DOCUMENTS,
  conversationId,
  initialMessages = EMPTY_MESSAGES,
  selectedPdfText = '',
  citationPlacement = 'inline',
  answerStyle = 'balanced',
  summary = '',
  accountInitial = 'Y',
  onEnsureConversation,
  onCitationClick,
  onRemoveDocument,
  onStageChange,
  onAttach,
  onClearSelectedText,
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [question, setQuestion] = useState('')
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const requestIdRef = useRef(0)
  const requestConversationIdRef = useRef(undefined)
  const lastQuestion = useRef('')
  const listRef = useRef(null)

  useEffect(() => { setMessages(initialMessages) }, [initialMessages, conversationId])
  useEffect(() => {
    if (requestConversationIdRef.current === undefined || requestConversationIdRef.current === conversationId) return undefined
    requestIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    requestConversationIdRef.current = undefined
    setStage('')
    return undefined
  }, [conversationId])
  useEffect(() => { onStageChange?.(stage ? STAGE_LABELS[stage] || stage : '') }, [stage, onStageChange])
  // `scrollTo` is optional: jsdom (and older engines) do not implement it.
  useEffect(() => { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, stage])

  const ask = async (nextQuestion = question) => {
    const clean = nextQuestion.trim()
    if (!clean || !documentIds.length || stage) return
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current
    const queryText = selectedPdfText ? `Regarding this selected passage:\n“${selectedPdfText}”\n\n${clean}` : clean
    lastQuestion.current = queryText
    setQuestion('')
    setError('')
    setMessages(current => [...current, { role: 'user', content: queryText, created_at: new Date().toISOString() }])
    setStage('validating')
    try {
      const activeConversationId = conversationId || await onEnsureConversation?.(clean)
      requestConversationIdRef.current = activeConversationId
      await streamQuery({ question: queryText, document_ids: documentIds, conversation_id: activeConversationId || undefined, answer_style: answerStyle }, {
        signal: controller.signal,
        onEvent: event => {
          if (requestId !== requestIdRef.current || controller.signal.aborted) return
          if (event.type === 'status') setStage(event.stage)
          if (event.type === 'error') throw new Error(event.detail)
          if (event.type === 'result') {
            setMessages(current => [...current, {
              role: 'assistant',
              content: event.answer,
              sources: event.sources,
              trace_id: event.trace_id,
              created_at: new Date().toISOString(),
            }])
            setStage('')
          }
        },
      })
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return
      setStage('')
      if (requestError.name !== 'AbortError') setError(requestError.message || 'The query failed.')
    }
  }

  const contextualPrompt = selectedPdfText ? `Regarding this selected passage:\n“${selectedPdfText}”\n\n` : ''
  const lastAssistantIndex = messages.map(message => message.role).lastIndexOf('assistant')

  return (
    <div className='chat-workspace'>
      {documents.length > 0 && (
        <div className='document-chips' aria-label='Documents in scope'>
          {documents.map(document => (
            <div className='document-chip' key={document.document_id}>
              <FileText size={13} strokeWidth={1.7} aria-hidden='true' />
              <span title={document.filename}>{document.filename}</span>
              {onRemoveDocument && (
                <button
                  type='button'
                  className='icon-button sm'
                  aria-label={`Remove ${document.filename} from this inquiry`}
                  onClick={() => onRemoveDocument(document.document_id)}
                >
                  <X size={12} strokeWidth={1.8} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className='message-list' ref={listRef} aria-live='polite'>
        {messages.length === 0 && (
          <div className='chat-intro'>
            <span className='kicker'>New inquiry</span>
            <h1>What would you like to understand?</h1>
            <p>Answers combine semantic and BM25 retrieval, then link back to the original pages.</p>
            {summary && <aside className='document-summary'><strong>Document overview</strong><p>{summary}</p></aside>}
          </div>
        )}

        {messages.map((message, index) => {
          const time = timeOf(message)
          if (message.role !== 'assistant') {
            return (
              <article className='message user' key={`user-${index}`}>
                <span className='message-avatar' aria-hidden='true'>{accountInitial}</span>
                <div className='message-body'>
                  <p>{message.content}</p>
                  {time && <span className='message-time'>{time}</span>}
                </div>
              </article>
            )
          }
          return (
            <article className='message assistant' key={`assistant-${index}`}>
              <span className='message-avatar' aria-hidden='true'><Landmark size={14} strokeWidth={1.6} /></span>
              <div className='message-body'>
                <h3 className='message-title'>Verified from your sources</h3>
                <FormattedAnswer text={message.content} sources={message.sources} citationPlacement={citationPlacement} onCitationClick={onCitationClick} />
                <div className='message-actions'>
                  {index === lastAssistantIndex && lastQuestion.current && !stage && (
                    <button type='button' className='btn btn-secondary' onClick={() => ask(lastQuestion.current)}>
                      <RotateCcw size={13} strokeWidth={1.8} aria-hidden='true' /> Retry
                    </button>
                  )}
                  <button type='button' className='btn btn-secondary' onClick={() => navigator.clipboard.writeText(message.content)}>
                    <Copy size={13} strokeWidth={1.8} aria-hidden='true' /> Copy
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {stage && (
          <div className='pipeline-status'>
            <span>
              <span className='status-pulse' aria-hidden='true' />
              {STAGE_LABELS[stage] || stage} across {documentIds.length} document{documentIds.length === 1 ? '' : 's'}…
            </span>
            <button type='button' className='btn btn-primary' onClick={() => abortRef.current?.abort()}>
              <Square size={12} fill='currentColor' stroke='none' aria-hidden='true' /> Stop
            </button>
          </div>
        )}
        {error && <p className='workspace-error' role='alert'>{error}</p>}
      </div>

      <form className='composer' onSubmit={event => { event.preventDefault(); ask(question) }}>
        {selectedPdfText && (
          <>
            <div className='selection-context-header'>
              <span className='kicker'>Selected text to ask about</span>
              <button type='button' className='selection-context-close' aria-label='Clear selected text' onClick={onClearSelectedText}>
                <X size={14} strokeWidth={1.8} aria-hidden='true' />
              </button>
            </div>
            <p className='selection-context'>{selectedPdfText}</p>
          </>
        )}
        <textarea
          className='input'
          aria-label='Ask a question'
          value={question}
          maxLength={4000}
          rows={2}
          placeholder={documentIds.length ? 'Ask across the selected documents…' : 'Select a document first'}
          onChange={event => setQuestion(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              ask(question)
            }
          }}
          disabled={!documentIds.length}
        />
        <div className='composer-actions'>
          <div className='composer-tools'>
            <button type='button' aria-label='Attach a file' onClick={onAttach} disabled={!onAttach}>
              <Paperclip size={15} strokeWidth={1.7} />
            </button>
            <button
              type='button'
              aria-label='Expand composer'
              onClick={event => {
                const textarea = event.currentTarget.closest('form')?.querySelector('textarea')
                if (textarea) textarea.style.minHeight = textarea.style.minHeight === '180px' ? '' : '180px'
              }}
            >
              <Maximize2 size={15} strokeWidth={1.7} />
            </button>
          </div>
          <button type='submit' className='btn btn-primary composer-send' aria-label='Ask' disabled={!question.trim() || !!stage}>
            <Send size={15} strokeWidth={1.9} />
          </button>
        </div>
      </form>
    </div>
  )
}
