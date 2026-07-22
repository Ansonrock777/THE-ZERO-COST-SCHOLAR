import { Children, useRef, useState } from 'react'
import { Moon, Settings, Sun } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppShell({
  documents = [],
  conversations = [],
  selectedDocumentIds = [],
  activeDocument,
  activeConversationId,
  mobilePane,
  theme,
  onToggleDocument,
  onMobilePaneChange,
  onThemeChange,
  onNewConversation,
  onSelectConversation,
  onPinConversation,
  onDeleteConversation,
  onExportConversation,
  onRenameConversation,
  onOpenSettings,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [chatWidth, setChatWidth] = useState(42)
  const splitRef = useRef(null)
  const panes = Children.toArray(children)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const startResize = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const move = moveEvent => {
      const bounds = splitRef.current?.getBoundingClientRect()
      if (!bounds?.width) return
      setChatWidth(Math.min(70, Math.max(30, ((moveEvent.clientX - bounds.left) / bounds.width) * 100)))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div className='scholar-app' data-theme={theme}>
      <Sidebar
        collapsed={collapsed}
        onCollapse={() => setCollapsed(value => !value)}
        documents={documents}
        conversations={conversations}
        selectedDocumentIds={selectedDocumentIds}
        activeConversationId={activeConversationId}
        onToggleDocument={onToggleDocument}
        onNewConversation={onNewConversation}
        onSelectConversation={onSelectConversation}
        onPinConversation={onPinConversation}
        onDeleteConversation={onDeleteConversation}
        onExportConversation={onExportConversation}
        onRenameConversation={onRenameConversation}
      />
      <main className='workspace-main'>
        <header className='workspace-topbar'>
          <div>
            <span className='workspace-kicker'>Ask across {selectedDocumentIds.length} document{selectedDocumentIds.length === 1 ? '' : 's'}</span>
            <strong>{activeDocument?.filename || 'Choose documents from your library'}</strong>
          </div>
          <div className='topbar-actions'>
            <button type='button' className='quiet-button' onClick={onOpenSettings}><Settings size={16} /> Settings</button>
            <button type='button' className='icon-button' aria-label={`Switch to ${nextTheme} theme`} onClick={() => onThemeChange(nextTheme)}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <div className='mobile-pane-tabs' aria-label='Workspace panes'>
          <button type='button' aria-pressed={mobilePane === 'chat'} onClick={() => onMobilePaneChange('chat')}>Chat</button>
          <button type='button' aria-pressed={mobilePane === 'pdf'} onClick={() => onMobilePaneChange('pdf')}>PDF</button>
        </div>
        <div className='split-workspace' ref={splitRef} style={{ '--chat-width': `${chatWidth}%` }}>
          <section className={`chat-pane ${mobilePane === 'chat' ? 'mobile-active' : ''}`} aria-label='Chat workspace'>{panes[0]}</section>
          <div className='split-resizer' role='separator' aria-label='Resize chat and PDF panes' aria-orientation='vertical' tabIndex='0' onPointerDown={startResize} onKeyDown={event => { if (event.key === 'ArrowLeft') setChatWidth(value => Math.max(30, value - 2)); if (event.key === 'ArrowRight') setChatWidth(value => Math.min(70, value + 2)) }} />
          <section className={`pdf-pane ${mobilePane === 'pdf' ? 'mobile-active' : ''}`} aria-label='PDF workspace'>{panes[1]}</section>
        </div>
      </main>
    </div>
  )
}
