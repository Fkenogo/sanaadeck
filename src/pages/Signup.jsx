import { Navigate } from 'react-router-dom'
import SignupForm from '@/components/auth/SignupForm'
import { useAuth } from '@/hooks/useAuth'

function Signup() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <SignupForm />
    </main>
  )
}

export default Signup
