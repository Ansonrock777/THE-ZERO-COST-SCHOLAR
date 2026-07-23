// frontend/src/hooks/usePdfDocument.js
// Fetches the raw PDF bytes for a document from the backend, using the same
// authenticated axios instance as the rest of the app. Both the PDF viewer
// and the download button consume the same fetched bytes (no second request).
import { useCallback, useEffect, useState } from 'react'
import api from '../lib/apiClient'

export function usePdfDocument(documentId) {
  const [bytes, setBytes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const fetchPdf = useCallback(async () => {
    if (!documentId) {
      setBytes(null)
      setNotFound(false)
      setError('')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setNotFound(false)

    try {
      const { data } = await api.get(`/documents/${documentId}/file`, { responseType: 'arraybuffer' })
      setBytes(new Uint8Array(data))
    } catch (err) {
      setBytes(null)
      if (err.response?.status === 404) {
        setNotFound(true)
      } else {
        setError('Unable to load PDF: ' + (err.message ?? 'unknown error'))
      }
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchPdf()
  }, [fetchPdf])

  return { bytes, loading, error, notFound, refetch: fetchPdf }
}
