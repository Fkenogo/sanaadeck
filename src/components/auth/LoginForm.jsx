import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function LoginForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname || '/dashboard'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    setSubmitting(true)

    try {
      await signIn(email.trim(), password)
      console.log('[LoginForm] Login successful')
      navigate(from, { replace: true })
    } catch (submitError) {
      console.error('[LoginForm] Login failed:', submitError)
      setError(submitError?.message || 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
          autoComplete="current-password"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {submitting ? 'Signing in...' : 'Sign in'}
      </button>

      <p className="text-sm text-muted-foreground">
        New here? <Link to="/signup" className="underline">Create an account</Link>
      </p>
    </form>
  )
}

export default LoginForm
