// frontend/src/components/Dashboard/SourceChunks.jsx
// Citation display — shows each retrieved chunk with its page number.
// Clicking a citation (when the page is known) jumps the PDF pane to it.
export default function SourceChunks({ sources, onCitationClick = () => {} }) {
  if (!sources || sources.length === 0) return null

  return (
    <div className='mt-4 space-y-2'>
      <h3 className='text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted dark:text-slate-400'>
        Sources
      </h3>
      {sources.map((source, i) => {
        const clickable = typeof source.page === 'number'
        return (
          <button
            key={i}
            type='button'
            disabled={!clickable}
            onClick={() => onCitationClick(source, i)}
            className='w-full rounded-xl border border-black/[0.06] bg-white/70 p-3 text-left transition-colors enabled:hover:border-highlight-border enabled:hover:bg-highlight-bg/15 disabled:opacity-80 dark:border-slate-700 dark:bg-slate-800/60 dark:enabled:hover:bg-slate-700'
          >
            <div className='mb-2 flex items-center justify-between text-xs'>
              <span className='inline-flex items-center gap-1.5 font-medium text-ink-soft dark:text-slate-200'>
                <span className='inline-flex min-w-[1.25rem] items-center justify-center rounded-[4px] bg-highlight-bg px-1.5 py-0.5 text-[10px] font-semibold text-highlight-text ring-1 ring-highlight-border/70'>
                  {i + 1}
                </span>
                Page {source.page}
              </span>
              <span className='text-ink-muted dark:text-slate-400'>
                {typeof source.score === 'number' ? `distance ${source.score}` : 'adjacent context'}
              </span>
            </div>
            <p className='line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft dark:text-slate-300'>
              {source.text}
            </p>
          </button>
        )
      })}
    </div>
  )
}
