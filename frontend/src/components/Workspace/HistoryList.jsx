import { useMemo, useState } from 'react'
import { Download, Pencil, Pin, Search, Trash2 } from 'lucide-react'

export default function HistoryList({
  conversations = [],
  activeId,
  onSelect,
  onPin,
  onDelete,
  onExport,
  onRename,
}) {
  const [search, setSearch] = useState('')
  const visibleConversations = useMemo(() => conversations.filter(conversation => (conversation.title || 'New inquiry').toLowerCase().includes(search.toLowerCase())), [conversations, search])
  return (
    <section className='history-section' aria-labelledby='history-heading'>
      <div className='sidebar-search'>
        <Search size={15} aria-hidden='true' />
        <input type='search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search inquiries' aria-label='Search inquiries' />
      </div>
      <h2 id='history-heading' className='sidebar-eyebrow'>History</h2>
      <div className='history-list'>
        {visibleConversations.length === 0 && <p className='sidebar-empty'>No matching inquiries.</p>}
        {visibleConversations.map(conversation => (
          <article key={conversation.id} className={`history-item ${activeId === conversation.id ? 'is-active' : ''}`}>
            <button type='button' className='history-main' onClick={() => onSelect?.(conversation.id)}>
              <span>{conversation.title || 'New inquiry'}</span>
              <small>{conversation.pinned ? 'Pinned' : 'Recent'}</small>
            </button>
            <div className='history-actions'>
              <button type='button' aria-label={`Pin ${conversation.title}`} onClick={() => onPin?.(conversation)}><Pin size={14} /></button>
              <button type='button' aria-label={`Rename ${conversation.title}`} onClick={() => onRename?.(conversation)}><Pencil size={14} /></button>
              <button type='button' aria-label={`Export ${conversation.title}`} onClick={() => onExport?.(conversation)}><Download size={14} /></button>
              <button type='button' aria-label={`Delete ${conversation.title}`} onClick={() => onDelete?.(conversation)}><Trash2 size={14} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
