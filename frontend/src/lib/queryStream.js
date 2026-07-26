import { supabase } from './supabaseClient'

export async function streamQuery(payload, { signal, onEvent }) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!response.ok || !response.body) throw new Error(`Query failed (${response.status})`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line))
    if (done) break
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer))
}
