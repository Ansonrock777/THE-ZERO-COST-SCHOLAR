export function Progress({ value = 0, className = '' }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={`progress ${className}`.trim()}
      role='progressbar'
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className='progress-value' style={{ width: `${clamped}%` }} />
    </div>
  )
}
