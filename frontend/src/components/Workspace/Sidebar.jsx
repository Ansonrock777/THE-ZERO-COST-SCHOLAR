import { BookOpen, ChevronLeft, FileText, Plus } from 'lucide-react'
import HistoryList from './HistoryList'

export default function Sidebar({
  collapsed,
  onCollapse,
  documents,
  conversations,
  selectedDocumentIds,
  activeConversationId,
  onToggleDocument,
  onNewConversation,
  onSelectConversation,
  onPinConversation,
  onDeleteConversation,
  onExportConversation,
  onRenameConversation,
}) {
  return (
    <nav className='workspace-sidebar' aria-label='Workspace navigation' data-collapsed={collapsed}>
      <div className='brand-row'>
        <span className='brand-mark'><BookOpen size={18} /></span>
        {!collapsed && <strong>The Zero-Cost Scholar</strong>}
        <button type='button' className='icon-button collapse-button' aria-label='Collapse navigation' onClick={onCollapse}>
          <ChevronLeft size={17} />
        </button>
      </div>
      <button type='button' className='new-inquiry' onClick={onNewConversation}>
        <Plus size={17} /><span>New inquiry</span>
      </button>
      <section className='document-list' aria-labelledby='library-heading'>
        <h2 id='library-heading' className='sidebar-eyebrow'>Library</h2>
        {documents.map(document => (
          <label className='document-option' key={document.document_id}>
            <input
              type='checkbox'
              checked={selectedDocumentIds.includes(document.document_id)}
              onChange={() => onToggleDocument(document.document_id)}
              aria-label={document.filename}
            />
            <FileText size={16} aria-hidden='true' />
            <span title={document.filename}>{document.filename}</span>
          </label>
        ))}
      </section>
      {!collapsed && (
        <HistoryList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onPin={onPinConversation}
          onDelete={onDeleteConversation}
          onExport={onExportConversation}
          onRename={onRenameConversation}
        />
      )}
    </nav>
  )
}
