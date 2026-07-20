export function Button({ className = '', disabled, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
