import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, userProfile, loading, initialized } = useAuth()
  const location = useLocation()

  if (!initialized) {
    return <div className="p-6 text-sm text-muted-foreground">Checking authentication...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (loading && !userProfile) {
    return <div className="p-6 text-sm text-muted-foreground">Loading user profile...</div>
  }

  if (!userProfile) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
