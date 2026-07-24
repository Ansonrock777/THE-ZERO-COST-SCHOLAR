// frontend/src/components/Dashboard/SourceChunks.jsx
// Citation display — shows each retrieved chunk with its page number
export default function SourceChunks({ sources }) {
  if (!sources || sources.length === 0) return null

  return (
    <div className='space-y-2 mt-4'>
      <h3 className='font-semibold text-sm text-slate-700'>Sources</h3>
      {sources.map((source, i) => (
        <div key={i} className='border border-slate-200 rounded-md p-3 bg-slate-50'>
          <div className='flex items-center justify-between text-xs text-slate-500 mb-2'>
            <span className='inline-flex items-center gap-1.5 font-medium text-slate-700'>
              <span className='inline-block bg-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[10px] font-semibold'>
                {i + 1}
              </span>
              Page {source.page}
            </span>
            <span className='text-slate-400'>
              {typeof source.score === 'number' ? `distance ${source.score}` : 'adjacent context'}
            </span>
          </div>
          <p className='text-sm text-slate-600 whitespace-pre-wrap leading-relaxed'>{source.text}</p>
        </div>
      ))}
    </div>
  )
}
