import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/apiClient', () => ({
  default: { post: vi.fn() },
}))

import { createQueryPayload } from './QueryPanel'

describe('createQueryPayload', () => {
  it('sends only the question and selected document ID', () => {
    expect(createQueryPayload('Question?', {
      document_id: 'doc-1',
      collection_name: 'must-not-leak',
    })).toEqual({ question: 'Question?', document_id: 'doc-1' })
  })
})
