import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'

/**
 * Route guard: renders the nested routes only when a session exists, otherwise
 * redirects to /login and remembers where the user was headed (returnUrl).
 */
export function RequireAuth() {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
