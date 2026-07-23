// frontend/src/components/Dashboard/DocumentChips.jsx
// Center pane's document pill row (single-select, presentational).
import { FileText } from 'lucide-react'

export default function DocumentChips({ documents, selectedId, onChange }) {
  if (!documents || documents.length === 0) return null

  return (
    <div
      role='group'
      aria-label='Document chips'
      className='flex flex-wrap gap-2 border-b border-black/[0.06] bg-cream-panel px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900'
    >
      {documents.map(document => {
        const isSelected = document.document_id === selectedId
        return (
          <button
            key={document.document_id}
            type='button'
            aria-current={isSelected || undefined}
            onClick={() => onChange(document.document_id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected
                ? 'border-navy-900 bg-navy-900 text-white shadow-sm'
                : 'border-black/10 bg-white text-ink-soft hover:border-forest/40 hover:text-ink dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <FileText size={12} className={isSelected ? 'text-forest-light' : 'text-red-500'} />
            <span className='max-w-[10rem] truncate'>{document.filename}</span>
          </button>
        )
      })}
    </div>
  )
}
