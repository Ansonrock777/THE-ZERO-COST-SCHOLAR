// frontend/src/components/Dashboard/PdfHighlightOverlay.jsx
// Renders inside react-pdf's <Page> (which is position:relative), so `rects`
// — already page-relative, from lib/pdfTextMatch.js — line up without any
// extra coordinate translation. Purely decorative: never blocks interaction
// with the page underneath it.
export default function PdfHighlightOverlay({ rects, label }) {
  if (!rects || rects.length === 0) return null

  const first = rects[0]
  const badgeSize = 20
  const badgeCenterX = Math.max(first.left - 14, badgeSize / 2)
  const badgeCenterY = Math.max(first.top - 14, badgeSize / 2)
  const targetX = first.left
  const targetY = first.top + Math.min(first.height, 14) / 2

  return (
    <div className='pointer-events-none absolute inset-0 z-30' aria-hidden='true'>
      {rects.map((rect, i) => (
        <div
          key={i}
          className='absolute rounded-sm bg-highlight-bg/60 ring-1 ring-highlight-border'
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ))}
      <svg className='absolute inset-0 h-full w-full overflow-visible'>
        <path
          d={`M ${badgeCenterX} ${badgeCenterY} Q ${badgeCenterX} ${targetY} ${targetX} ${targetY}`}
          fill='none'
          stroke='#f5c451'
          strokeWidth='1.5'
        />
      </svg>
      <span
        className='absolute flex items-center justify-center rounded-full border border-highlight-border bg-highlight-bg text-[11px] font-semibold text-highlight-text shadow-sm'
        style={{
          top: badgeCenterY - badgeSize / 2,
          left: badgeCenterX - badgeSize / 2,
          width: badgeSize,
          height: badgeSize,
        }}
      >
        {label}
      </span>
    </div>
  )
}
