import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) } } }))
import { streamQuery } from './queryStream'

afterEach(() => vi.unstubAllGlobals())

describe('streamQuery', () => {
  it('parses newline-delimited events split across chunks', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('{"type":"status","stage":"retr')); controller.enqueue(encoder.encode('ieving"}\n{"type":"result","answer":"done"}\n')); controller.close() } })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const events = []
    await streamQuery({ question: 'q' }, { onEvent: event => events.push(event) })
    expect(events).toEqual([{ type: 'status', stage: 'retrieving' }, { type: 'result', answer: 'done' }])
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
  })
})
