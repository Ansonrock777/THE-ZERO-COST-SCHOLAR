export function Button({ className = '', disabled, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg bg-forest text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
