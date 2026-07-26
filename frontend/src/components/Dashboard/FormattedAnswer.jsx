const CITATION_RE = /\[Source\s+(\d+)\]|\u3010(?:Source\s+)?(\d+)\u3011/gu

function renderInline(text, keyPrefix, sources, onCitationClick) {
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
      if (match.index > lastIndex) nodes.push(part.slice(lastIndex, match.index))
      const number = match[1] ?? match[2]
      const source = sources?.[Number(number) - 1]
      nodes.push(<sup key={`${keyPrefix}-${nodeIndex++}`} className='citation-marker'>
        <button type='button' aria-label={`Open citation ${number}${source?.filename ? ` in ${source.filename}` : ''}`} onClick={() => onCitationClick?.(source)}>{number}</button>
      </sup>)
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

export default function FormattedAnswer({ text, sources = [], onCitationClick, citationPlacement = 'inline' }) {
  if (!text) return null
  const blocks = []
  let listBuffer = []
  let listType = null
  const flushList = () => {
    if (!listBuffer.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    blocks.push(<Tag key={`list-${blocks.length}`}>{listBuffer.map((item, index) => <li key={index}>{renderInline(item, `li-${blocks.length}-${index}`, sources, onCitationClick)}</li>)}</Tag>)
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
      if (trimmed) blocks.push(<p key={`p-${index}`}>{renderInline(trimmed, `p-${index}`, sources, onCitationClick)}</p>)
    }
  })
  flushList()
  return <div className='formatted-answer'>{blocks}{citationPlacement === 'footnotes' && sources.length > 0 && <ol className='citation-footnotes'>{sources.map((source, index) => <li key={`${source.document_id}-${source.chunk_index}-${index}`}><button type='button' onClick={() => onCitationClick?.(source)}>{source.filename}, page {source.page}</button></li>)}</ol>}</div>
}
