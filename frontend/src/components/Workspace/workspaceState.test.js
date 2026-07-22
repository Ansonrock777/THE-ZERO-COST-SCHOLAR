import { beforeEach, describe, expect, it } from 'vitest'
import { loadWorkspacePreferences, saveWorkspacePreferences, toggleSelection } from './workspaceState'

beforeEach(() => localStorage.clear())

describe('workspace state', () => {
  it('adds and removes document ids without duplicates', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('persists selected documents, conversation, theme, and active mobile pane', () => {
    saveWorkspacePreferences({
      selectedDocumentIds: ['a', 'b'],
      conversationId: 'conversation-1',
      theme: 'dark',
      mobilePane: 'pdf',
    })

    expect(loadWorkspacePreferences()).toEqual({
      selectedDocumentIds: ['a', 'b'],
      conversationId: 'conversation-1',
      theme: 'dark',
      mobilePane: 'pdf',
    })
  })

  it('returns safe defaults for invalid persisted JSON', () => {
    localStorage.setItem('zero-cost-scholar.workspace', '{bad json')

    expect(loadWorkspacePreferences()).toEqual({
      selectedDocumentIds: [],
      conversationId: null,
      theme: 'light',
      mobilePane: 'chat',
    })
  })
})
