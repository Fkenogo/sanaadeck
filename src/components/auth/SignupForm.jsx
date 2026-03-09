import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const countries = ['KE', 'UG', 'RW', 'BI']

function SignupForm() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client',
    displayName: '',
    phone: '',
    businessName: '',
    industry: '',
    country: 'KE',
    subscriptionTier: 'starter',
    specialty: 'graphic_design',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isClient = form.role === 'client'

  const validationError = useMemo(() => {
    if (!form.email || !form.password || !form.displayName) {
      return 'Email, password, and display name are required.'
    }

    if (form.password.length < 8) {
      return 'Password must be at least 8 characters.'
    }

    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.'
    }

    if (isClient && !form.businessName) {
      return 'Business name is required for client accounts.'
    }

    return ''
  }, [form, isClient])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      await signUp(form.email.trim(), form.password, {
        role: form.role,
        displayName: form.displayName,
        phone: form.phone,
        businessName: form.businessName,
        industry: form.industry,
        country: form.country,
        subscriptionTier: form.subscriptionTier,
        specialty: form.specialty,
      })

      navigate('/dashboard', { replace: true })
    } catch (submitError) {
      console.error('[SignupForm] Signup failed:', submitError)
      setError(submitError?.message || 'Unable to create account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm" htmlFor="role">
          Role
        </label>
        <select
          id="role"
          value={form.role}
          onChange={(event) => updateField('role', event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
        >
          <option value="client">Client</option>
          <option value="creative">Creative</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          value={form.displayName}
          onChange={(event) => updateField('displayName', event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => updateField('email', event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          value={form.phone}
          onChange={(event) => updateField('phone', event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      {isClient ? (
        <>
          <div>
            <label className="mb-1 block text-sm" htmlFor="businessName">
              Business name
            </label>
            <input
              id="businessName"
              value={form.businessName}
              onChange={(event) => updateField('businessName', event.target.value)}
              className="w-full rounded border border-border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm" htmlFor="industry">
              Industry
            </label>
            <input
              id="industry"
              value={form.industry}
              onChange={(event) => updateField('industry', event.target.value)}
              className="w-full rounded border border-border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm" htmlFor="country">
              Country
            </label>
            <select
              id="country"
              value={form.country}
              onChange={(event) => updateField('country', event.target.value)}
              className="w-full rounded border border-border px-3 py-2"
            >
              {countries.map((countryCode) => (
                <option key={countryCode} value={countryCode}>
                  {countryCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm" htmlFor="subscriptionTier">
              Plan tier
            </label>
            <select
              id="subscriptionTier"
              value={form.subscriptionTier}
              onChange={(event) => updateField('subscriptionTier', event.target.value)}
              className="w-full rounded border border-border px-3 py-2"
            >
              <option value="starter">Starter (15 credits)</option>
              <option value="growth">Growth (30 credits)</option>
              <option value="pro">Pro (60 credits)</option>
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-sm" htmlFor="specialty">
            Specialty
          </label>
          <select
            id="specialty"
            value={form.specialty}
            onChange={(event) => updateField('specialty', event.target.value)}
            className="w-full rounded border border-border px-3 py-2"
          >
            <option value="graphic_design">Graphic Design</option>
            <option value="illustration">Illustration</option>
            <option value="motion_graphics">Motion Graphics</option>
            <option value="copywriting">Copywriting</option>
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(event) => updateField('password', event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={(event) => updateField('confirmPassword', event.target.value)}
          className="w-full rounded border border-border px-3 py-2"
          autoComplete="new-password"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {submitting ? 'Creating account...' : 'Create account'}
      </button>

      <p className="text-sm text-muted-foreground">
        Already have an account? <Link to="/login" className="underline">Sign in</Link>
      </p>
    </form>
  )
}

export default SignupForm
