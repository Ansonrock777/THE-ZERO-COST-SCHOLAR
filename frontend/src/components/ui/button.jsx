// Thin wrappers over the design system's .btn classes so callers stay
// declarative about intent rather than repeating class strings.
export function Button({ variant = 'primary', className = '', disabled, children, ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`.trim()} disabled={disabled} {...props}>
      {children}
    </button>
  )
}
