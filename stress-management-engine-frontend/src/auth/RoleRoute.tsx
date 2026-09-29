import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from '../types/auth'
export function RoleRoute({ allowedRoles }: { allowedRoles: Role[] }) { const { user } = useAuth(); return user && allowedRoles.includes(user.role) ? <Outlet /> : <Navigate to="/403" replace /> }
