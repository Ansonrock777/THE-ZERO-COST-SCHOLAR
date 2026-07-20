// frontend/src/components/Dashboard/FormattedAnswer.jsx
// Renders the LLM's answer: bold, bullet/numbered lists, and inline
// [Source N] / 【N】 citation markers as small badges — without a markdown dependency.

const CITATION_RE = /\[Source (\d+)\]|【(\d+)】/g

function renderInline(text, keyPrefix) {
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
      nodes.push(
        <sup key={`${keyPrefix}-${n++}`}
          className='inline-block bg-slate-200 text-slate-700 rounded px-1 text-[10px] font-semibold mx-0.5 not-italic'>
          {num}
        </sup>
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

export default function FormattedAnswer({ text }) {
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
        {listBuffer.map((item, i) => <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>)}
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
        blocks.push(<p key={`p-${i}`}>{renderInline(trimmed, `p-${i}`)}</p>)
      }
    }
  })
  flushList()

  return <div className='space-y-2 leading-relaxed'>{blocks}</div>
}
