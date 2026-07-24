export default function DocumentSelector({ documents, selectedId, onChange, loading, error }) {
  if (loading) return <p role='status'>Loading documents...</p>
  if (error) return <p role='alert'>{error}</p>
  if (documents.length === 0) return <p>No uploaded documents yet.</p>

  return (
    <div className='space-y-2'>
      <label className='block text-sm font-medium text-slate-700' htmlFor='document-selector'>
        Document
      </label>
      <select
        id='document-selector'
        className='w-full min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400'
        value={selectedId}
        onChange={event => onChange(event.target.value)}
      >
        {documents.map(document => (
          <option key={document.document_id} value={document.document_id}>
            {document.filename}
          </option>
        ))}
      </select>
    </div>
  )
}
