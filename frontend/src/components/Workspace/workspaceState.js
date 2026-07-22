const STORAGE_KEY = 'zero-cost-scholar.workspace'

export const DEFAULT_WORKSPACE_PREFERENCES = {
  selectedDocumentIds: [],
  conversationId: null,
  theme: 'light',
  mobilePane: 'chat',
}

export function toggleSelection(selectedIds, documentId) {
  return selectedIds.includes(documentId)
    ? selectedIds.filter(id => id !== documentId)
    : [...selectedIds, documentId]
}

export function loadWorkspacePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_WORKSPACE_PREFERENCES }
    return {
      selectedDocumentIds: Array.isArray(saved.selectedDocumentIds) ? saved.selectedDocumentIds : [],
      conversationId: typeof saved.conversationId === 'string' ? saved.conversationId : null,
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      mobilePane: saved.mobilePane === 'pdf' ? 'pdf' : 'chat',
    }
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFERENCES }
  }
}

export function saveWorkspacePreferences(preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}
