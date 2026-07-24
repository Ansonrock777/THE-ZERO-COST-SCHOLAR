export function Progress({ value = 0, className = '' }) {
  return (
    <div className={`w-full h-2 rounded-full bg-black/10 overflow-hidden dark:bg-white/10 ${className}`}>
      <div
        className="h-full bg-forest transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
