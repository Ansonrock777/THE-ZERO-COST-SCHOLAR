export function Card({ className = '', children, ...props }) {
  return <div className={`card ${className}`.trim()} {...props}>{children}</div>
}

export function CardHeader({ className = '', children, ...props }) {
  return <div className={`card-header ${className}`.trim()} {...props}>{children}</div>
}

export function CardTitle({ className = '', children, ...props }) {
  return <h3 className={`card-title ${className}`.trim()} {...props}>{children}</h3>
}

export function CardContent({ className = '', children, ...props }) {
  return <div className={`card-content ${className}`.trim()} {...props}>{children}</div>
}
