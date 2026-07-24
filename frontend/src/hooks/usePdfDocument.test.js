import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/apiClient', () => ({
  default: { get: vi.fn() },
}))

import api from '../lib/apiClient'
import { usePdfDocument } from './usePdfDocument'

afterEach(() => vi.clearAllMocks())

describe('usePdfDocument', () => {
  it('does not fetch when no document ID is given', () => {
    const { result } = renderHook(() => usePdfDocument(''))

    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.bytes).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('fetches and exposes the PDF bytes', async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    api.get.mockResolvedValue({ data: buffer })

    const { result } = renderHook(() => usePdfDocument('doc-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(api.get).toHaveBeenCalledWith('/documents/doc-1/file', { responseType: 'arraybuffer' })
    expect(result.current.bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(result.current.notFound).toBe(false)
    expect(result.current.error).toBe('')
  })

  it('sets notFound on a 404 without treating it as an error', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => usePdfDocument('doc-2'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notFound).toBe(true)
    expect(result.current.error).toBe('')
    expect(result.current.bytes).toBeNull()
  })

  it('sets an error message for non-404 failures', async () => {
    api.get.mockRejectedValue({ message: 'Network Error' })

    const { result } = renderHook(() => usePdfDocument('doc-3'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notFound).toBe(false)
    expect(result.current.error).toContain('Network Error')
  })

  it('refetch re-runs the request', async () => {
    const buffer = new Uint8Array([9]).buffer
    api.get.mockResolvedValue({ data: buffer })

    const { result } = renderHook(() => usePdfDocument('doc-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(api.get).toHaveBeenCalledTimes(1)

    await result.current.refetch()

    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
