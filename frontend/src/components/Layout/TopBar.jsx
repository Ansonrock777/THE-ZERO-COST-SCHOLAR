// frontend/src/components/Layout/TopBar.jsx
// Top strip of the center chat column: title/status on the left, decorative
// settings gear + functional theme toggle + user menu on the right.
import { useState } from 'react'
import { Menu, Settings, Sun, Moon, ChevronDown } from 'lucide-react'

export default function TopBar({ title, status, email, theme, onToggleTheme, onSignOut, onOpenSidebar }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = (email || '?').charAt(0).toUpperCase()

  return (
    <header className='flex items-center justify-between gap-4 border-b border-black/[0.06] bg-cream-panel px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900'>
      <div className='flex min-w-0 items-center gap-3'>
        <button
          type='button'
          onClick={onOpenSidebar}
          className='rounded-md p-1.5 text-ink-muted hover:bg-black/5 xl:hidden dark:text-slate-300 dark:hover:bg-slate-800'
          aria-label='Open sidebar'
        >
          <Menu size={18} />
        </button>
        <div className='flex min-w-0 items-center gap-3'>
          <h1 className='truncate font-medium text-ink dark:text-slate-100'>{title}</h1>
          {status && (
            <span className='hidden shrink-0 items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-medium text-forest sm:inline-flex dark:bg-forest/20 dark:text-forest-light'>
              <span className='relative flex h-1.5 w-1.5'>
                <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-forest opacity-60' />
                <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-forest' />
              </span>
              {status}
            </span>
          )}
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-2 text-sm'>
        <button
          type='button'
          className='rounded-md p-2 text-ink-muted hover:bg-black/5 dark:text-slate-400 dark:hover:bg-slate-800'
          aria-label='Settings'
          title='Settings (coming soon)'
        >
          <Settings size={16} />
        </button>

        <div className='hidden items-center rounded-full border border-black/[0.06] bg-black/[0.03] p-0.5 sm:flex dark:border-slate-700 dark:bg-slate-800'>
          <button
            type='button'
            onClick={() => theme !== 'light' && onToggleTheme()}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              theme === 'light' ? 'bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white' : 'text-ink-muted dark:text-slate-400'
            }`}
          >
            <Sun size={13} /> Light
          </button>
          <button
            type='button'
            onClick={() => theme !== 'dark' && onToggleTheme()}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              theme === 'dark' ? 'bg-navy-900 text-white shadow-sm' : 'text-ink-muted dark:text-slate-400'
            }`}
          >
            <Moon size={13} /> Dark
          </button>
        </div>

        <div className='relative'>
          <button
            type='button'
            onClick={() => setMenuOpen(open => !open)}
            aria-label='User menu'
            className='flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 hover:bg-black/5 dark:hover:bg-slate-800'
          >
            <span className='flex h-7 w-7 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white'>
              {initial}
            </span>
            <ChevronDown size={14} className='text-ink-muted dark:text-slate-400' />
          </button>
          {menuOpen && (
            <div className='absolute right-0 z-20 mt-2 w-56 rounded-lg border border-black/[0.06] bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800'>
              <p className='truncate px-3 py-2 text-xs text-ink-muted dark:text-slate-400'>{email}</p>
              <button
                type='button'
                onClick={onSignOut}
                className='block w-full px-3 py-2 text-left text-sm text-ink-soft hover:bg-black/[0.03] dark:text-slate-200 dark:hover:bg-slate-700'
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
