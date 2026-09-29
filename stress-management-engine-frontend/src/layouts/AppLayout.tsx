import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Header } from '../components/layout/Header'
import { Sidebar } from '../components/layout/Sidebar'

export function AppLayout() { const { user, logout } = useAuth(); const [open, setOpen] = useState(false); if (!user) return null; return <div className="min-h-screen bg-slate-50 text-slate-900"><Sidebar role={user.role} open={open} onClose={() => setOpen(false)} /><div className="lg:pl-72"><Header username={user.username} role={user.role} onMenu={() => setOpen(true)} onLogout={logout} /><main className="mx-auto max-w-7xl p-6 sm:p-8"><Outlet /></main></div></div> }
