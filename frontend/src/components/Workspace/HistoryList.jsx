import { forwardRef, useMemo } from 'react'
import { Download, Pencil, Pin, Trash2 } from 'lucide-react'

const DAY = 24 * 60 * 60 * 1000

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

/** Bucket label for a conversation's timestamp — "Today", "Yesterday", the
 *  weekday inside the last week, then the date. Undated rows fall to
 *  "Earlier" so a conversation is never dropped from the archive. */
export function groupLabel(timestamp, now = Date.now()) {
  if (!timestamp) return 'Earlier'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Earlier'
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** The right-hand figure on a row: clock time for today, the bucket otherwise. */
function rowTime(timestamp, label) {
  if (!timestamp || label === 'Earlier') return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  if (label !== 'Today') return label
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Group conversations into ordered, labelled buckets, pinned ones first. */
export function groupConversations(conversations, now = Date.now()) {
  const groups = []
  const byLabel = new Map()
  const push = (label, item) => {
    if (!byLabel.has(label)) {
      const group = { label, items: [] }
      byLabel.set(label, group)
      groups.push(group)
    }
    byLabel.get(label).items.push(item)
  }

  for (const conversation of conversations) {
    const timestamp = conversation.updated_at || conversation.created_at
    const label = conversation.pinned ? 'Pinned' : groupLabel(timestamp, now)
    push(label, { conversation, time: conversation.pinned ? 'Pinned' : rowTime(timestamp, label) })
  }

  // "Pinned" always leads; the rest keep the order the API returned them in.
  return groups.sort((a, b) => (a.label === 'Pinned' ? -1 : b.label === 'Pinned' ? 1 : 0))
}

const HistoryList = forwardRef(function HistoryList({
  conversations = [],
  search = '',
  activeId,
  onSelect,
  onPin,
  onDelete,
  onExport,
  onRename,
}, ref) {
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matching = term
      ? conversations.filter(conversation => (conversation.title || 'New inquiry').toLowerCase().includes(term))
      : conversations
    return groupConversations(matching)
  }, [conversations, search])

  const isEmpty = groups.every(group => group.items.length === 0)

  return (
    <div className='history-list' ref={ref} aria-label='Inquiry history'>
      {isEmpty && <p className='sidebar-empty'>No matching inquiries.</p>}
      {groups.map(group => (
        <div className='history-group' key={group.label}>
          <span className='history-group-label'>{group.label}</span>
          {group.items.map(({ conversation, time }) => {
            const title = conversation.title || 'New inquiry'
            return (
              <div className={`history-item ${activeId === conversation.id ? 'is-active' : ''}`} key={conversation.id}>
                <button type='button' className='history-main' onClick={() => onSelect?.(conversation.id)}>
                  <span>{title}</span>
                  {time && <small>{time}</small>}
                </button>
                <div className='history-actions'>
                  <button type='button' aria-label={`Pin ${title}`} onClick={() => onPin?.(conversation)}><Pin size={13} strokeWidth={1.7} /></button>
                  <button type='button' aria-label={`Rename ${title}`} onClick={() => onRename?.(conversation)}><Pencil size={13} strokeWidth={1.7} /></button>
                  <button type='button' aria-label={`Export ${title}`} onClick={() => onExport?.(conversation)}><Download size={13} strokeWidth={1.7} /></button>
                  <button type='button' aria-label={`Delete ${title}`} onClick={() => onDelete?.(conversation)}><Trash2 size={13} strokeWidth={1.7} /></button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
})

export default HistoryList
