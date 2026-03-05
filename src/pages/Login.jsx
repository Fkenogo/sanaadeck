import { Navigate } from 'react-router-dom'
import LoginForm from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'

function Login() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Login</h1>
      <LoginForm />
    </main>
  )
}

export default Login
