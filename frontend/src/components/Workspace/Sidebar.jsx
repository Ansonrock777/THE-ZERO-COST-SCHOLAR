import { useRef, useState } from 'react'
import { BookOpen, Check, ChevronLeft, Clock, FileText, Library, Plus, Search } from 'lucide-react'
import HistoryList from './HistoryList'

export default function Sidebar({
  collapsed,
  onCollapse,
  documents = [],
  conversations = [],
  selectedDocumentIds = [],
  activeConversationId,
  onToggleDocument,
  onNewConversation,
  onSelectConversation,
  onPinConversation,
  onDeleteConversation,
  onExportConversation,
  onRenameConversation,
  onManageDocuments,
}) {
  // The two rails mark the sidebar's regions rather than routing anywhere —
  // both lists stay on screen, so selecting one scrolls it into view.
  const [section, setSection] = useState('library')
  const [search, setSearch] = useState('')
  const libraryRef = useRef(null)
  const historyRef = useRef(null)

  const showSection = (name, ref) => {
    setSection(name)
    ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }

  return (
    <nav className='workspace-sidebar' aria-label='Workspace navigation' data-collapsed={collapsed}>
      <div className='brand-row'>
        <span className='brand-mark' aria-hidden='true'><BookOpen size={16} strokeWidth={1.7} /></span>
        {!collapsed && <strong>The Zero-Cost Scholar</strong>}
        <button type='button' className='icon-button collapse-button' aria-label='Collapse navigation' onClick={onCollapse}>
          <ChevronLeft size={17} strokeWidth={1.8} />
        </button>
      </div>

      <div className='sidebar-section'>
        <button type='button' className='new-inquiry' onClick={onNewConversation}>
          <Plus size={15} strokeWidth={2} aria-hidden='true' /><span>New inquiry</span>
        </button>
      </div>

      <div className='sidebar-nav'>
        <button type='button' className='sidebar-nav-item' aria-current={section === 'library'} onClick={() => showSection('library', libraryRef)}>
          <Library size={15} strokeWidth={1.7} aria-hidden='true' /><span>Library</span>
        </button>
        <button type='button' className='sidebar-nav-item' aria-current={section === 'history'} onClick={() => showSection('history', historyRef)}>
          <Clock size={15} strokeWidth={1.7} aria-hidden='true' /><span>History</span>
        </button>
      </div>

      <h2 className='sidebar-eyebrow' id='library-heading' ref={libraryRef}>Documents ({documents.length})</h2>

      <div className='document-list' role='group' aria-labelledby='library-heading'>
        {documents.length === 0 && <p className='sidebar-empty'>No documents yet.</p>}
        {documents.map(document => {
          const selected = selectedDocumentIds.includes(document.document_id)
          return (
            <label className='document-option' key={document.document_id}>
              {/* The checkbox stays a real input — visually hidden by the
                  system's .checkbox rule — so the swatch beside it is purely
                  decorative and the control keeps its role and label. */}
              <input
                className='checkbox'
                type='checkbox'
                checked={selected}
                onChange={() => onToggleDocument?.(document.document_id)}
                aria-label={document.filename}
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

      {onManageDocuments && (
        <div className='sidebar-manage'>
          <button type='button' className='manage-documents' onClick={onManageDocuments}>Manage documents</button>
        </div>
      )}

      <div className='sidebar-search'>
        <Search size={14} strokeWidth={1.8} aria-hidden='true' />
        <input
          type='search'
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder='Search inquiries'
          aria-label='Search inquiries'
        />
        <kbd aria-hidden='true'>⌘K</kbd>
      </div>

      <HistoryList
        ref={historyRef}
        conversations={conversations}
        search={search}
        activeId={activeConversationId}
        onSelect={onSelectConversation}
        onPin={onPinConversation}
        onDelete={onDeleteConversation}
        onExport={onExportConversation}
        onRename={onRenameConversation}
      />
    </nav>
  )
}
