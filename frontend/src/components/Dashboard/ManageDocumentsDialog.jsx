import { Check, FileText, X } from 'lucide-react'
import UploadPanel from './UploadPanel'

/** The library manager behind the sidebar's "Manage documents" button: add a
 *  PDF, and see or change which of the indexed documents are in scope. */
export default function ManageDocumentsDialog({
  open,
  documents = [],
  selectedDocumentIds = [],
  onToggleDocument,
  onUploadComplete,
  onClose,
}) {
  if (!open) return null

  return (
    <div
      className='dialog-backdrop'
      role='presentation'
      onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}
    >
      <section className='dialog' role='dialog' aria-modal='true' aria-labelledby='manage-documents-title'>
        <header className='dialog-header'>
          <div>
            <span className='kicker'>Library</span>
            <h2 className='dialog-title' id='manage-documents-title'>Manage documents</h2>
          </div>
          <button type='button' className='icon-button' aria-label='Close document manager' onClick={onClose}>
            <X size={17} strokeWidth={1.8} />
          </button>
        </header>

        <UploadPanel onUploadComplete={onUploadComplete} />

        {documents.length > 0 && (
          <div className='document-list manage-list'>
            {documents.map(document => {
              const selected = selectedDocumentIds.includes(document.document_id)
              return (
                <label className='document-option' key={document.document_id}>
                  <input
                    className='checkbox'
                    type='checkbox'
                    checked={selected}
                    onChange={() => onToggleDocument?.(document.document_id)}
                    aria-label={`Include ${document.filename}`}
                  />
                  <FileText size={14} strokeWidth={1.6} aria-hidden='true' />
                  <span title={document.filename}>{document.filename}</span>
                  <span className='document-check' aria-hidden='true'>
                    {selected && <Check size={10} strokeWidth={3.2} />}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
