// frontend/src/components/Dashboard/SourceChunks.jsx
// Citation display — shows each retrieved chunk with its page number
export default function SourceChunks({ sources }) {
  if (!sources || sources.length === 0) return null

  return (
    <div className='space-y-2 mt-4'>
      <h3 className='font-semibold text-sm text-slate-700'>Sources</h3>
      {sources.map((source, i) => (
        <div key={i} className='border border-slate-200 rounded-md p-3 bg-slate-50'>
          <div className='flex items-center justify-between text-xs text-slate-500 mb-1'>
            <span className='font-medium text-slate-700'>{source.label}</span>
            <span>Page {source.page} · score {source.score}</span>
          </div>
          <p className='text-sm text-slate-600 whitespace-pre-wrap'>{source.text}</p>
        </div>
      ))}
    </div>
  )
}
