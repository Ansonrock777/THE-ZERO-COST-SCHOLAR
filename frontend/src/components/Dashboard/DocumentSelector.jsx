// frontend/src/components/Dashboard/DocumentSelector.jsx
// Sidebar's vertical document list (single-select, deletable).
import { FileText, Trash2, Check } from 'lucide-react'

export default function DocumentSelector({ documents, selectedId, onChange, loading, error, onDelete = () => {} }) {
  if (loading) return <p role='status' className='px-3 text-sm text-slate-400'>Loading documents...</p>
  if (error) return <p role='alert' className='px-3 text-sm text-red-400'>{error}</p>
  if (documents.length === 0) return <p className='px-3 text-sm text-slate-400'>No uploaded documents yet.</p>

  return (
    <ul aria-label='Saved documents' className='space-y-0.5'>
      {documents.map(document => {
        const isSelected = document.document_id === selectedId
        return (
          <li key={document.document_id} className='group flex items-center gap-1'>
            <button
              type='button'
              aria-current={isSelected || undefined}
              onClick={() => onChange(document.document_id)}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                isSelected ? 'bg-navy-800 text-white' : 'text-slate-300 hover:bg-navy-800/60 hover:text-white'
              }`}
            >
              <FileText size={14} className={`shrink-0 ${isSelected ? 'text-forest-light' : 'text-slate-500'}`} />
              <span className='truncate'>{document.filename}</span>
              {isSelected && <Check size={14} className='ml-auto shrink-0 text-forest-light' />}
            </button>
            <button
              type='button'
              onClick={() => onDelete(document)}
              aria-label={`Delete ${document.filename}`}
              title='Delete document'
              className='shrink-0 rounded p-1.5 text-slate-500 opacity-0 transition-opacity hover:bg-navy-800 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100'
            >
              <Trash2 size={13} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
