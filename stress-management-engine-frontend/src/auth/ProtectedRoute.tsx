import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { RouteLoader } from '../components/common/LoadingStates'
export function ProtectedRoute() { const { isAuthenticated, isInitializing } = useAuth(); const location = useLocation(); if (isInitializing) return <RouteLoader />; return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} /> }
