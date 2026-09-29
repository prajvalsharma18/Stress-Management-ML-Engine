import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { useAuth } from '../auth/AuthContext'
import { ButtonLoader } from '../components/common/LoadingStates'
import { getRoleHome } from '../routes/roleHome'
import { getApiErrorMessage } from '../utils/apiError'

export function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sessionExpired = params.get('reason') === 'session-expired'
  useEffect(() => { if (user && !sessionExpired) navigate(getRoleHome(user.role) || '/403', { replace: true }) }, [user, navigate, sessionExpired])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) { setError('Enter your username and password.'); return }
    setError(''); setBusy(true)
    try {
      const nextUser = await login({ username: username.trim(), password })
      const requested = (location.state as { from?: string } | null)?.from
      navigate(requested || getRoleHome(nextUser.role) || '/403', { replace: true })
    } catch (err) {
      const response = (err as AxiosError).response
      setError(response?.status === 401 ? 'Invalid username or password.' : getApiErrorMessage(err, 'Unable to sign in. Please try again.'))
    } finally { setBusy(false) }
  }

  return <div><div className="flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-800 text-sm font-bold text-white">S</div><span className="font-semibold tracking-[0.18em] text-slate-950">SURAKSHAI</span></div><div className="mt-12 max-w-md"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Secure sign in</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2><p className="mt-3 text-sm leading-6 text-slate-500">Secure support for personnel through human-centred welfare intelligence.</p>{sessionExpired && <div role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Your session has expired. Please sign in again.</div>}{error && <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>}<form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-slate-700">Username<input required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none ring-teal-700 focus:ring-2" autoComplete="username" /></label><label className="block text-sm font-medium text-slate-700">Password<div className="relative mt-2"><input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 outline-none ring-teal-700 focus:ring-2" autoComplete="current-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-slate-500 hover:text-slate-900">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label><button type="submit" disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <ButtonLoader label="Signing in..." /> : <><ShieldCheck className="h-4 w-4" />Sign in</>}</button></form></div></div>
}
