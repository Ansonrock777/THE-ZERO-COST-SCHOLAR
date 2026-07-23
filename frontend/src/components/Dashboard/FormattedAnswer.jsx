// frontend/src/components/Dashboard/FormattedAnswer.jsx
// Renders the LLM's answer: bold, bullet/numbered lists, and inline
// [Source N] / 【N】 citation markers as small badges — without a markdown dependency.
// When `sources`/`onCitationClick` are given and the cited source has a known
// page, the badge becomes clickable (jumps the PDF pane to that page).

const CITATION_RE = /\[Source\s+(\d+)\]|【(\d+)】/gu

function renderInline(text, keyPrefix, sources, onCitationClick) {
  // Split on **bold** first, then run citation matching on the plain segments.
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  const nodes = []
  let n = 0

  for (const part of boldParts) {
    if (!part) continue
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/)
    if (boldMatch) {
      nodes.push(<strong key={`${keyPrefix}-${n++}`}>{boldMatch[1]}</strong>)
      continue
    }

    let lastIndex = 0
    let match
    CITATION_RE.lastIndex = 0
    while ((match = CITATION_RE.exec(part)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(part.slice(lastIndex, match.index))
      }
      const num = match[1] ?? match[2]
      const source = sources?.[Number(num) - 1]
      const clickable = source && typeof source.page === 'number'

      nodes.push(
        <sup
          key={`${keyPrefix}-${n++}`}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onClick={clickable ? () => onCitationClick(source, Number(num) - 1) : undefined}
          onKeyDown={clickable ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onCitationClick(source, Number(num) - 1)
            }
          } : undefined}
          className={`mx-0.5 inline-flex min-w-[1.15em] items-center justify-center rounded-[4px] px-1 text-[10px] font-semibold not-italic ${
            clickable
              ? 'cursor-pointer bg-highlight-bg text-highlight-text ring-1 ring-highlight-border/70 transition hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight-border'
              : 'bg-black/[0.06] text-ink-muted dark:bg-white/10 dark:text-slate-300'
          }`}
        >
          {num}
        </sup>,
      )
      lastIndex = CITATION_RE.lastIndex
    }
    if (lastIndex < part.length) nodes.push(part.slice(lastIndex))
  }

  return nodes
}

// Plain-text version for truncated previews (history list, etc.) — strips
// markdown syntax and citation markers instead of rendering badges.
export function stripMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(CITATION_RE, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function FormattedAnswer({ text, sources, onCitationClick = () => {} }) {
  if (!text) return null

  const lines = text.split('\n')
  const blocks = []
  let listBuffer = []
  let listType = null

  const flushList = () => {
    if (listBuffer.length === 0) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`list-${blocks.length}`}
        className={Tag === 'ol' ? 'list-decimal pl-5 space-y-1' : 'list-disc pl-5 space-y-1'}>
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`, sources, onCitationClick)}</li>
        ))}
      </Tag>
    )
    listBuffer = []
    listType = null
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/)

    if (bulletMatch) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push(bulletMatch[1])
    } else if (numberedMatch) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push(numberedMatch[1])
    } else {
      flushList()
      if (trimmed.length > 0) {
        blocks.push(<p key={`p-${i}`}>{renderInline(trimmed, `p-${i}`, sources, onCitationClick)}</p>)
      }
    }
  })
  flushList()

  return <div className='space-y-2 leading-relaxed'>{blocks}</div>
}
