<<<<<<< HEAD
const CITATION_RE = /\[Source\s+(\d+)\]|【(\d+)】/gu

function renderInline(text, keyPrefix, sources, onCitationClick) {
=======
// frontend/src/components/Dashboard/FormattedAnswer.jsx
// Renders the LLM's answer: bold, bullet/numbered lists, and inline
// [Source N] / 【N】 citation markers as small badges — without a markdown dependency.
// When `sources`/`onCitationClick` are given and the cited source has a known
// page, the badge becomes clickable (jumps the PDF pane to that page).

const CITATION_RE = /\[Source\s+(\d+)\]|【(\d+)】/gu

function renderInline(text, keyPrefix, sources, onCitationClick) {
  // Split on **bold** first, then run citation matching on the plain segments.
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  const nodes = []
  let nodeIndex = 0
  for (const part of boldParts) {
    if (!part) continue
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/)
    if (boldMatch) {
      nodes.push(<strong key={`${keyPrefix}-${nodeIndex++}`}>{boldMatch[1]}</strong>)
      continue
    }
    let lastIndex = 0
    let match
    CITATION_RE.lastIndex = 0
    while ((match = CITATION_RE.exec(part)) !== null) {
<<<<<<< HEAD
      if (match.index > lastIndex) nodes.push(part.slice(lastIndex, match.index))
      const number = match[1] ?? match[2]
      const source = sources?.[Number(number) - 1]
      nodes.push(<sup key={`${keyPrefix}-${nodeIndex++}`} className='citation-marker'>
        <button type='button' aria-label={`Open citation ${number}${source?.filename ? ` in ${source.filename}` : ''}`} onClick={() => onCitationClick?.(source)}>{number}</button>
      </sup>)
=======
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
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
      lastIndex = CITATION_RE.lastIndex
    }
    if (lastIndex < part.length) nodes.push(part.slice(lastIndex))
  }
  return nodes
}

export function stripMarkdown(text) {
  if (!text) return ''
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(CITATION_RE, '').replace(/^[-*]\s+/gm, '').replace(/\s+/g, ' ').trim()
}

<<<<<<< HEAD
export default function FormattedAnswer({ text, sources = [], onCitationClick, citationPlacement = 'inline' }) {
=======
export default function FormattedAnswer({ text, sources, onCitationClick = () => {} }) {
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
  if (!text) return null
  const blocks = []
  let listBuffer = []
  let listType = null
  const flushList = () => {
    if (!listBuffer.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
<<<<<<< HEAD
    blocks.push(<Tag key={`list-${blocks.length}`}>{listBuffer.map((item, index) => <li key={index}>{renderInline(item, `li-${blocks.length}-${index}`, sources, onCitationClick)}</li>)}</Tag>)
=======
    blocks.push(
      <Tag key={`list-${blocks.length}`}
        className={Tag === 'ol' ? 'list-decimal pl-5 space-y-1' : 'list-disc pl-5 space-y-1'}>
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`, sources, onCitationClick)}</li>
        ))}
      </Tag>
    )
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
    listBuffer = []
    listType = null
  }
  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim()
    const bullet = trimmed.match(/^[-*]\s+(.*)/)
    const numbered = trimmed.match(/^\d+\.\s+(.*)/)
    if (bullet || numbered) {
      const nextType = bullet ? 'ul' : 'ol'
      if (listType && listType !== nextType) flushList()
      listType = nextType
      listBuffer.push((bullet || numbered)[1])
    } else {
      flushList()
<<<<<<< HEAD
      if (trimmed) blocks.push(<p key={`p-${index}`}>{renderInline(trimmed, `p-${index}`, sources, onCitationClick)}</p>)
=======
      if (trimmed.length > 0) {
        blocks.push(<p key={`p-${i}`}>{renderInline(trimmed, `p-${i}`, sources, onCitationClick)}</p>)
      }
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
    }
  })
  flushList()
  return <div className='formatted-answer'>{blocks}{citationPlacement === 'footnotes' && sources.length > 0 && <ol className='citation-footnotes'>{sources.map((source, index) => <li key={`${source.document_id}-${source.chunk_index}-${index}`}><button type='button' onClick={() => onCitationClick?.(source)}>{source.filename}, page {source.page}</button></li>)}</ol>}</div>
}
