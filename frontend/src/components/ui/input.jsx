export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-forest/50 focus:outline-none focus:ring-2 focus:ring-forest/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${className}`}
      {...props}
    />
  )
}
