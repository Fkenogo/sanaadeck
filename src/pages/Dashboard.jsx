import { Suspense, lazy } from 'react'
import { useAuth } from '@/hooks/useAuth'

const AdminDashboard = lazy(() => import('@/components/dashboard/AdminDashboard'))
const ClientDashboard = lazy(() => import('@/components/dashboard/ClientDashboard'))
const CreativeDashboard = lazy(() => import('@/components/dashboard/CreativeDashboard'))

function Dashboard() {
  const { userProfile } = useAuth()

  if (!userProfile) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">SanaaDeck Dashboard</h1>
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </main>
    )
  }

  if (userProfile.role === 'client') {
    return (
      <Suspense fallback={<main className="p-6"><p className="text-sm text-muted-foreground">Loading dashboard...</p></main>}>
        <ClientDashboard />
      </Suspense>
    )
  }

  if (userProfile.role === 'creative') {
    return (
      <Suspense fallback={<main className="p-6"><p className="text-sm text-muted-foreground">Loading dashboard...</p></main>}>
        <CreativeDashboard />
      </Suspense>
    )
  }

  if (userProfile.role === 'super_admin') {
    return (
      <Suspense fallback={<main className="p-6"><p className="text-sm text-muted-foreground">Loading dashboard...</p></main>}>
        <AdminDashboard mode="super" />
      </Suspense>
    )
  }

  if (userProfile.role === 'admin') {
    const adminType = userProfile.adminType || 'project_admin'
    if (adminType === 'app_admin') {
      return (
        <Suspense fallback={<main className="p-6"><p className="text-sm text-muted-foreground">Loading dashboard...</p></main>}>
          <AdminDashboard mode="app" />
        </Suspense>
      )
    }
    return (
      <Suspense fallback={<main className="p-6"><p className="text-sm text-muted-foreground">Loading dashboard...</p></main>}>
        <AdminDashboard mode="project" />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<main className="p-6"><p className="text-sm text-muted-foreground">Loading dashboard...</p></main>}>
      <AdminDashboard mode="project" />
    </Suspense>
  )
}

export default Dashboard
