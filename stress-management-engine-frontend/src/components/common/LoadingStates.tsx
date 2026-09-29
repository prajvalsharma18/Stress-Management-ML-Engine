import { LoaderCircle } from 'lucide-react'

export function PageLoader({ label = 'Loading workspace' }: { label?: string }) { return <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />{label}</div> }
export function RouteLoader() { return <PageLoader label="Checking session..." /> }
export function ButtonLoader({ label = 'Working...' }: { label?: string }) { return <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</span> }
