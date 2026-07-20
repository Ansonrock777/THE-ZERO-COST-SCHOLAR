// frontend/src/lib/apiClient.js
import axios from 'axios'
import { supabase } from './supabaseClient'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL })

// Interceptor: Attach the user's JWT to EVERY backend request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export default api
