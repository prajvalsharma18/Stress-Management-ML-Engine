import axios from 'axios'

export const AUTH_STORAGE_KEY = 'surakshai.session'
export const authExpiredEvent = 'surakshai:auth-expired'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL must be configured before starting the frontend.')

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const raw = sessionStorage.getItem(AUTH_STORAGE_KEY)
  if (raw) {
    try { config.headers.Authorization = `Bearer ${(JSON.parse(raw) as { token: string }).token}` } catch { sessionStorage.removeItem(AUTH_STORAGE_KEY) }
  }
  return config
})

apiClient.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && error.config?.url !== '/auth/login') window.dispatchEvent(new Event(authExpiredEvent))
  return Promise.reject(error)
})
