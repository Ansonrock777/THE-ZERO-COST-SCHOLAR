// frontend/src/components/Layout/Sidebar.jsx
// Always-pine sidebar: wordmark, New inquiry, Library/History section markers,
// document list, and searchable dated history.
import { useState } from 'react'
import { Library, History as HistoryIcon, Plus, Search, Upload, Landmark } from 'lucide-react'
import DocumentSelector from '../Dashboard/DocumentSelector'
import HistoryPanel from '../Dashboard/HistoryPanel'

export default function Sidebar({
  documents,
  selectedId,
  onSelectDocument,
  loadingDocuments,
  documentsError,
  onNewInquiry,
  onSelectHistory,
  onUploadClick,
  onDeleteDocument,
}) {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <aside className='flex h-full w-full flex-col bg-navy-900 text-white'>
      <div className='flex items-center gap-2.5 px-4 py-5'>
        <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-forest text-white shadow-sm'>
          <Landmark size={17} />
        </span>
        <h1 className='font-serif text-[17px] font-semibold leading-tight tracking-tight'>
          The Zero-Cost Scholar
        </h1>
      </div>

      <div className='px-3 pb-4'>
        <button
          type='button'
          onClick={onNewInquiry}
          className='flex w-full items-center justify-center gap-2 rounded-lg bg-forest px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-forest-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900'
        >
          <Plus size={16} /> New inquiry
        </button>
      </div>

      <nav className='space-y-0.5 px-3 pb-3 text-sm text-slate-300'>
        <button
          type='button'
          className='flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 transition-colors hover:bg-navy-800 hover:text-white'
        >
          <Library size={15} /> Library
        </button>
        <button
          type='button'
          className='flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 transition-colors hover:bg-navy-800 hover:text-white'
        >
          <HistoryIcon size={15} /> History
        </button>
      </nav>

      <div className='mx-3 border-t border-white/10' />

      <div className='scrollbar-slim flex-1 overflow-y-auto px-3 py-4'>
        <div className='flex items-center justify-between px-1 pb-1.5'>
          <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400'>
            Documents ({documents.length})
          </p>
          <button
            type='button'
            onClick={onUploadClick}
            aria-label='Upload a document'
            title='Upload a document'
            className='rounded p-1 text-slate-400 transition-colors hover:bg-navy-800 hover:text-white'
          >
            <Upload size={14} />
          </button>
        </div>
        <DocumentSelector
          documents={documents}
          selectedId={selectedId}
          onChange={onSelectDocument}
          loading={loadingDocuments}
          error={documentsError}
          onDelete={onDeleteDocument}
        />

        <div className='mt-6'>
          <div className='relative'>
            <Search size={14} className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500' />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder='Search inquiries'
              className='w-full rounded-lg border border-white/10 bg-navy-800 py-2 pl-8 pr-2 text-sm text-white placeholder:text-slate-500 focus:border-forest-light focus:outline-none focus:ring-1 focus:ring-forest-light'
            />
          </div>
        </div>

        <div className='mt-4'>
          <HistoryPanel searchTerm={searchTerm} onSelectHistory={onSelectHistory} />
        </div>
      </div>
    </aside>
  )
}
