import { Children, useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Moon, Settings, SlidersHorizontal, Sun } from 'lucide-react'
import Sidebar from './Sidebar'

const MIN_CHAT_WIDTH = 30
const MAX_CHAT_WIDTH = 70

function initial(label) {
  return (label || 'S').trim().charAt(0).toUpperCase()
}

export default function AppShell({
  documents = [],
  conversations = [],
  selectedDocumentIds = [],
  activeConversationId,
  mobilePane,
  theme,
  status = '',
  user,
  onToggleDocument,
  onSelectDocument,
  onMobilePaneChange,
  onThemeChange,
  onSelectConversation,
  onPinConversation,
  onDeleteConversation,
  onRenameConversation,
  onNewConversation,
  onManageDocuments,
  onOpenSettings,
  onSignOut,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [chatWidth, setChatWidth] = useState(42)
  const [menuOpen, setMenuOpen] = useState(false)
  const splitRef = useRef(null)
  const menuRef = useRef(null)
  const panes = Children.toArray(children)
  const documentCount = selectedDocumentIds.length
  const accountName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account'

  useEffect(() => {
    if (!menuOpen) return undefined
    const closeOnOutside = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false) }
    const closeOnEscape = event => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const startResize = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const move = moveEvent => {
      const bounds = splitRef.current?.getBoundingClientRect()
      if (!bounds?.width) return
      setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, ((moveEvent.clientX - bounds.left) / bounds.width) * 100)))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div className='scholar-app' data-theme={theme} data-sidebar-collapsed={collapsed}>
      <Sidebar
        collapsed={collapsed}
        onCollapse={() => setCollapsed(value => !value)}
        documents={documents}
        conversations={conversations}
        selectedDocumentIds={selectedDocumentIds}
        activeConversationId={activeConversationId}
        onToggleDocument={onToggleDocument}
        onSelectDocument={onSelectDocument}
        onSelectConversation={onSelectConversation}
        onPinConversation={onPinConversation}
        onDeleteConversation={onDeleteConversation}
        onRenameConversation={onRenameConversation}
        onNewConversation={onNewConversation}
        onManageDocuments={onManageDocuments}
      />

      <main className='workspace-main'>
        <header className='workspace-topbar'>
          <div className='topbar-title'>
            <strong>Ask across {documentCount} document{documentCount === 1 ? '' : 's'}</strong>
            {status && (
              <span className='topbar-status' role='status'>
                <span className='status-pulse' aria-hidden='true' />
                <span>{status}</span>
              </span>
            )}
          </div>

          <div className='topbar-actions'>
            <button type='button' className='quiet-button' onClick={onOpenSettings}>
              <Settings size={15} strokeWidth={1.7} /><span>Settings</span>
            </button>

            {/* Segmented light/dark control. Buttons rather than radios so the
                accessible name can state the action each option performs. */}
            <div className='seg theme-seg' role='group' aria-label='Colour theme'>
              <button
                type='button'
                className='seg-opt'
                aria-pressed={theme !== 'dark'}
                aria-label='Switch to light theme'
                onClick={() => onThemeChange('light')}
              >
                <Sun size={13} strokeWidth={1.8} aria-hidden='true' /><span aria-hidden='true'>Light</span>
              </button>
              <button
                type='button'
                className='seg-opt'
                aria-pressed={theme === 'dark'}
                aria-label='Switch to dark theme'
                onClick={() => onThemeChange('dark')}
              >
                <Moon size={13} strokeWidth={1.8} aria-hidden='true' /><span aria-hidden='true'>Dark</span>
              </button>
            </div>

            <div ref={menuRef}>
              <button
                type='button'
                className='user-chip'
                aria-label='User menu'
                aria-haspopup='menu'
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(open => !open)}
              >
                <span className='avatar' aria-hidden='true'>{initial(accountName)}</span>
                <span className='user-chip-name'>{accountName}</span>
                <ChevronDown size={13} strokeWidth={1.8} aria-hidden='true' />
              </button>
              {menuOpen && (
                <div className='user-menu' role='menu'>
                  {user?.email && <p>{user.email}</p>}
                  {/* A plain anchor, not a <Link>: the shell is rendered in
                      isolation by its tests and must not require a Router. */}
                  <a href='/developer' role='menuitem' onClick={() => setMenuOpen(false)}>
                    <SlidersHorizontal size={14} strokeWidth={1.7} aria-hidden='true' /> Developer dashboard
                  </a>
                  {onSignOut && (
                    <button type='button' role='menuitem' onClick={() => { setMenuOpen(false); onSignOut() }}>
                      <LogOut size={14} strokeWidth={1.7} aria-hidden='true' /> Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className='mobile-pane-tabs' aria-label='Workspace panes'>
          <button type='button' aria-pressed={mobilePane === 'chat'} onClick={() => onMobilePaneChange('chat')}>Chat</button>
          <button type='button' aria-pressed={mobilePane === 'pdf'} onClick={() => onMobilePaneChange('pdf')}>PDF</button>
        </div>

        <div className='split-workspace' ref={splitRef} style={{ '--chat-width': `${chatWidth}%` }}>
          <section className={`chat-pane ${mobilePane === 'chat' ? 'mobile-active' : ''}`} aria-label='Chat workspace'>{panes[0]}</section>
          <div
            className='split-resizer'
            role='separator'
            aria-label='Resize chat and PDF panes'
            aria-orientation='vertical'
            tabIndex='0'
            onPointerDown={startResize}
            onKeyDown={event => {
              if (event.key === 'ArrowLeft') setChatWidth(value => Math.max(MIN_CHAT_WIDTH, value - 2))
              if (event.key === 'ArrowRight') setChatWidth(value => Math.min(MAX_CHAT_WIDTH, value + 2))
            }}
          />
          <section className={`pdf-pane ${mobilePane === 'pdf' ? 'mobile-active' : ''}`} aria-label='PDF workspace'>{panes[1]}</section>
        </div>
      </main>
    </div>
  )
}
