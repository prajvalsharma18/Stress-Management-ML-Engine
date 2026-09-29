import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

const labels: Record<string, string> = { welfare: 'Welfare', commander: 'Commander', admin: 'Admin', dashboard: 'Dashboard' }
export function Breadcrumbs({ pathname }: { pathname: string }) { const parts = pathname.split('/').filter(Boolean); return <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500"><Link to="/" className="inline-flex items-center gap-1 hover:text-teal-800"><Home className="h-3.5 w-3.5" /><span className="sr-only">Dashboard</span></Link>{parts.map((part, index) => <span key={`${part}-${index}`} className="inline-flex items-center gap-2"><ChevronRight className="h-3 w-3 text-slate-300" /><span className={index === parts.length - 1 ? 'font-medium text-slate-700' : ''}>{labels[part] || 'Workspace'}</span></span>)}</nav> }
