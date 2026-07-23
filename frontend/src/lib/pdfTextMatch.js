// frontend/src/lib/pdfTextMatch.js
//
// Finds where a backend-extracted chunk of text (PyPDFLoader, server-side)
// approximately lands in a page's client-side pdf.js text layer, so we can
// draw a highlight overlay over it. The two extractors don't produce
// byte-identical text (different whitespace/line-break handling), so this is
// a best-effort fuzzy match, not an exact one — callers must treat
// `{ matched: false }` as a normal, silent outcome (e.g. scanned PDFs with no
// text layer at all), not an error.
import { match } from '@sanity/diff-match-patch'

// The Bitap algorithm this library uses can only search for patterns up to
// this many characters (a hard `throw` above it) — long chunk text has to be
// searched via short head/tail anchors instead of matched whole.
const MAX_PATTERN_LENGTH = 32
const MATCH_THRESHOLD = 0.4
const LINE_GROUP_TOLERANCE_PX = 3

export function normalize(str) {
  return (str ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function relativeRect(rect, containerRect) {
  return {
    top: rect.top - containerRect.top,
    left: rect.left - containerRect.left,
    width: rect.width,
    height: rect.height,
  }
}

/**
 * Correlates pdf.js's raw text items with the DOM spans react-pdf's text
 * layer renders for them, and builds a single normalized, space-joined
 * string covering the whole page plus each span's [start,end) offset into
 * it (so a matched character range can be mapped back to on-screen rects).
 *
 * `items` — pdf.js `getTextContent().items` (may include non-text marked
 * content entries, which render no DOM span at all and must be skipped).
 * `rects` — the *already-rendered* DOM spans' bounding rects, in the same
 * order `layer.querySelectorAll('[role="presentation"]')` returns them.
 * `containerRect` — the bounding rect of the positioned element rects should
 * be made relative to (read in the same tick as `rects` to avoid drift).
 *
 * Mirrors react-pdf's own item→span correlation rule exactly: an item only
 * gets a span if it has `str`, and consumes TWO DOM children (the span plus
 * a trailing line-break marker) when `item.hasEOL` is also true — get this
 * wrong and every highlight after the first wrapped line silently drifts.
 */
export function buildPageTextIndex(items, rects, containerRect) {
  let domIndex = 0
  let flatText = ''
  const spans = []

  for (const item of items) {
    if (!('str' in item)) continue // marked content — no DOM span rendered

    const rect = rects[domIndex]
    domIndex += item.str && item.hasEOL ? 2 : 1

    const normalized = normalize(item.str)
    if (!normalized || !rect) continue

    if (flatText.length > 0) flatText += ' '
    const start = flatText.length
    flatText += normalized

    spans.push({ start, end: flatText.length, rect: relativeRect(rect, containerRect) })
  }

  return { flatText, spans }
}

function anchorLocation(haystack, pattern, searchFrom) {
  if (!pattern) return -1
  const clipped = pattern.slice(0, MAX_PATTERN_LENGTH)
  return match(haystack, clipped, Math.max(0, searchFrom), {
    threshold: MATCH_THRESHOLD,
    distance: Math.max(haystack.length, 1),
  })
}

/**
 * Locates the approximate [start,end) character range of `chunkText` within
 * `pageIndex.flatText`, then maps that range back to per-line screen rects.
 * Returns `{ matched: false }` — never throws, never surfaces an error — when
 * no reasonable fuzzy match can be found.
 */
export function findHighlightRects(pageIndex, chunkText) {
  const haystack = pageIndex.flatText
  const needle = normalize(chunkText)
  if (!haystack || !needle) return { matched: false, rects: [] }

  let start
  let end
  if (needle.length <= MAX_PATTERN_LENGTH) {
    start = anchorLocation(haystack, needle, 0)
    if (start === -1) return { matched: false, rects: [] }
    end = start + needle.length
  } else {
    const head = needle.slice(0, MAX_PATTERN_LENGTH)
    const tail = needle.slice(-MAX_PATTERN_LENGTH)
    start = anchorLocation(haystack, head, 0)
    if (start === -1) return { matched: false, rects: [] }

    const expectedTailLocation = start + needle.length - tail.length
    const tailStart = anchorLocation(haystack, tail, expectedTailLocation)
    end = tailStart === -1 ? start + needle.length : tailStart + tail.length
  }

  end = Math.min(end, haystack.length)
  if (end <= start) return { matched: false, rects: [] }

  const overlapping = pageIndex.spans.filter(span => span.end > start && span.start < end)
  if (overlapping.length === 0) return { matched: false, rects: [] }

  return { matched: true, rects: groupRectsByLine(overlapping.map(span => span.rect)) }
}

/**
 * Merges per-span rects on the same visual line into one rect each, so a
 * highlight over wrapped text looks like real multi-line text selection
 * instead of one box spanning the whole paragraph's bounding area.
 */
export function groupRectsByLine(rects) {
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left)
  const lines = []

  for (const rect of sorted) {
    const line = lines.find(candidate => Math.abs(candidate.top - rect.top) <= LINE_GROUP_TOLERANCE_PX)
    if (!line) {
      lines.push({ top: rect.top, bottom: rect.top + rect.height, left: rect.left, right: rect.left + rect.width })
      continue
    }
    line.top = Math.min(line.top, rect.top)
    line.bottom = Math.max(line.bottom, rect.top + rect.height)
    line.left = Math.min(line.left, rect.left)
    line.right = Math.max(line.right, rect.left + rect.width)
  }

  return lines.map(line => ({
    top: line.top,
    left: line.left,
    width: line.right - line.left,
    height: line.bottom - line.top,
  }))
}
