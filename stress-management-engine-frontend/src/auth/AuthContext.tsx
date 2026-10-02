import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth.api'
import { AUTH_STORAGE_KEY, authExpiredEvent } from '../api/client'
import type { AuthUser, LoginRequest, Role } from '../types/auth'

interface Session { token: string; user: AuthUser; expiresAt: string }
interface AuthContextValue { user: AuthUser | null; isAuthenticated: boolean; isInitializing: boolean; login: (payload: LoginRequest) => Promise<AuthUser>; logout: () => void }
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const roles: Role[] = ['PERSONNEL', 'WELFARE_OFFICER', 'COMMANDER', 'ADMIN']
function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) || 'null')
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<Session>
    const expiry = typeof candidate.expiresAt === 'string' ? Date.parse(candidate.expiresAt) : Number.NaN
    if (typeof candidate.token !== 'string' || !candidate.token || !candidate.user || !roles.includes(candidate.user.role) || !Number.isFinite(expiry) || expiry <= Date.now()) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return candidate as Session
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)
  const [isInitializing, setIsInitializing] = useState(true)
  const navigate = useNavigate()
  const redirecting = useRef(false)
  const clearSession = useCallback(() => { sessionStorage.removeItem(AUTH_STORAGE_KEY); setSession(null) }, [])
  const logout = useCallback(() => { redirecting.current = false; clearSession(); navigate('/login', { replace: true }) }, [clearSession, navigate])
  useEffect(() => { localStorage.removeItem(AUTH_STORAGE_KEY); setIsInitializing(false); const expire = () => { if (redirecting.current) return; redirecting.current = true; clearSession(); window.location.replace('/login?reason=session-expired') }; window.addEventListener(authExpiredEvent, expire); return () => window.removeEventListener(authExpiredEvent, expire) }, [clearSession])
  const login = useCallback(async (payload: LoginRequest) => { const response = await authApi.login(payload); redirecting.current = false; const next = { token: response.access_token, user: response.user, expiresAt: response.expires_at }; sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next)); setSession(next); return response.user }, [])
  const value = useMemo(() => ({ user: session?.user || null, isAuthenticated: Boolean(session), isInitializing, login, logout }), [session, isInitializing, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
