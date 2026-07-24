import { describe, expect, it } from 'vitest'
import { buildPageTextIndex, findHighlightRects, groupRectsByLine, normalize } from './pdfTextMatch'

describe('normalize', () => {
  it('collapses whitespace runs, trims, and lowercases', () => {
    expect(normalize('  Hello\n\n World \t')).toBe('hello world')
  })

  it('returns an empty string for null/undefined', () => {
    expect(normalize(undefined)).toBe('')
    expect(normalize(null)).toBe('')
  })
})

describe('buildPageTextIndex', () => {
  it('correlates items to DOM spans, stepping by 2 for hasEOL items and skipping marked content', () => {
    const items = [
      { str: 'Hello', hasEOL: false },
      { str: 'world', hasEOL: true }, // consumes its span + a trailing EOL marker (2 DOM children)
      { type: 'beginMarkedContent' }, // no 'str' — renders no span at all, must not shift the index
      { str: 'Second', hasEOL: false },
    ]
    const rects = [
      { top: 110, left: 60, width: 40, height: 12 }, // Hello
      { top: 110, left: 105, width: 45, height: 12 }, // world
      { top: 999, left: 999, width: 0, height: 0 }, // world's EOL marker — must be skipped, never read
      { top: 130, left: 60, width: 50, height: 12 }, // Second
    ]
    const containerRect = { top: 100, left: 50 }

    const index = buildPageTextIndex(items, rects, containerRect)

    expect(index.flatText).toBe('hello world second')
    expect(index.spans).toEqual([
      { start: 0, end: 5, rect: { top: 10, left: 10, width: 40, height: 12 } },
      { start: 6, end: 11, rect: { top: 10, left: 55, width: 45, height: 12 } },
      { start: 12, end: 18, rect: { top: 30, left: 10, width: 50, height: 12 } },
    ])
  })

  it('skips items with empty text or a missing rect', () => {
    const items = [{ str: '   ', hasEOL: false }, { str: 'Real', hasEOL: false }]
    const rects = [{ top: 0, left: 0, width: 1, height: 1 }, { top: 0, left: 0, width: 10, height: 10 }]

    const index = buildPageTextIndex(items, rects, { top: 0, left: 0 })

    expect(index.flatText).toBe('real')
    expect(index.spans).toHaveLength(1)
  })
})

describe('findHighlightRects', () => {
  function pageWith(text) {
    const words = text.split(' ')
    let flatText = ''
    const spans = []
    words.forEach((word, i) => {
      if (flatText.length > 0) flatText += ' '
      const start = flatText.length
      flatText += word
      spans.push({ start, end: flatText.length, rect: { top: 10 * i, left: 0, width: word.length * 6, height: 12 } })
    })
    return { flatText, spans }
  }

  it('returns matched:false when the page has no text layer at all', () => {
    expect(findHighlightRects({ flatText: '', spans: [] }, 'anything')).toEqual({ matched: false, rects: [] })
  })

  it('returns matched:false for an empty/blank chunk', () => {
    const page = pageWith('hello world second')
    expect(findHighlightRects(page, '   ')).toEqual({ matched: false, rects: [] })
  })

  it('finds an exact short substring and returns its span rects', () => {
    const page = pageWith('hello world second')

    const result = findHighlightRects(page, 'world second')

    expect(result.matched).toBe(true)
    expect(result.rects.length).toBeGreaterThan(0)
  })

  it('tolerates a small character-level divergence (fuzzy match, not exact indexOf)', () => {
    const page = pageWith('the quick brown fox jumps over the lazy dog')

    // Backend extraction sometimes drops/garbles a character across a
    // hyphenation break — a plain indexOf would fail here, the fuzzy
    // matcher should not.
    const result = findHighlightRects(page, 'quick brwn fox jumps')

    expect(result.matched).toBe(true)
  })

  it('matches long chunk text (>32 normalized chars) via head/tail anchors', () => {
    const page = pageWith(
      'introduction to information retrieval effectiveness depends on many factors including the collection the queries and the retrieval model',
    )
    const longChunk = 'effectiveness depends on many factors including the collection the queries and the retrieval model'

    const result = findHighlightRects(page, longChunk)

    expect(result.matched).toBe(true)
    expect(result.rects.length).toBeGreaterThan(0)
  })

  it('does not throw on a chunk far longer than the whole page (degrades to matched:false or a bounded match)', () => {
    const page = pageWith('short page text only')
    const hugeChunk = 'word '.repeat(200)

    expect(() => findHighlightRects(page, hugeChunk)).not.toThrow()
  })
})

describe('groupRectsByLine', () => {
  it('merges rects on the same line and keeps separate lines apart', () => {
    const rects = [
      { top: 10, left: 0, width: 20, height: 12 },
      { top: 11, left: 20, width: 15, height: 12 }, // same line (within tolerance)
      { top: 30, left: 0, width: 25, height: 12 }, // new line
    ]

    const merged = groupRectsByLine(rects)

    expect(merged).toHaveLength(2)
    expect(merged[0]).toEqual({ top: 10, left: 0, width: 35, height: 13 })
    expect(merged[1]).toEqual({ top: 30, left: 0, width: 25, height: 12 })
  })

  it('returns an empty array for no rects', () => {
    expect(groupRectsByLine([])).toEqual([])
  })
})
