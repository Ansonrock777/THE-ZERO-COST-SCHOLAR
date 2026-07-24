export function Progress({ value = 0, className = '' }) {
  return (
    <div className={`w-full h-2 rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className="h-full bg-slate-900 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
