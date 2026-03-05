import React, { useMemo, useState } from 'react'
import pricingService from '@/services/pricingService'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase'

const UnifiedPaymentForm = ({
  tier,
  paymentType = 'subscription',
  clientId,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  })

  const countries = useMemo(() => pricingService.getSupportedCountries(), [])
  const pricing = useMemo(() => {
    if (!country) return null
    const prices = pricingService.getAllPrices(country)
    return paymentType === 'extra_credits' ? prices.extraPack : prices[tier]
  }, [country, paymentType, tier])
  const paymentMethods = useMemo(() => {
    if (!country) return []
    return pricingService.getPaymentMethods(country)
  }, [country])

  const handleCountrySelect = (selectedCountry) => {
    setCountry(selectedCountry)
    setStep(2)
  }

  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method)
    setStep(3)
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = String(formData.email || '').trim()
    const phoneNumber = String(formData.phoneNumber || '').trim()
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const phoneValid = /^\+?[0-9]{8,15}$/.test(phoneNumber)

    if (!emailValid) {
      setError('Please enter a valid email address.')
      return
    }
    if (!phoneValid) {
      setError('Please enter a valid phone number with country code.')
      return
    }
    if (!clientId) {
      setError('Client account not found. Please sign in again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const initiatePesapalPayment = httpsCallable(functions, 'initiatePesapalPayment')

      const response = await initiatePesapalPayment({
        clientId,
        amount: pricing.amount,
        currency: pricing.currency,
        email,
        phoneNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        reason:
          paymentType === 'subscription'
            ? `SanaaDeck ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`
            : 'SanaaDeck Extra Credits',
        country,
        tier: paymentType === 'subscription' ? tier : null,
        paymentType,
        paymentMethod,
      })

      if (response.data.success) {
        if (typeof onSuccess === 'function') {
          onSuccess(response.data)
        }
        window.location.href = response.data.redirectUrl
      } else {
        setError('Payment initiation failed. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded border border-border bg-white p-6">
      <h2 className="mb-6 text-2xl font-bold">{paymentType === 'subscription' ? 'Subscribe' : 'Purchase Extra Credits'}</h2>

      {step === 1 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Your Country</h3>
          <div className="grid grid-cols-1 gap-3">
            {countries.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCountrySelect(c.code)}
                className="flex items-center justify-between rounded-lg border-2 p-4 transition hover:border-blue-500 hover:bg-blue-50"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{c.flag}</span>
                  <div className="text-left">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-gray-500">{c.currency}</div>
                  </div>
                </div>
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Payment Method</h3>
            <button className="rounded border border-border px-3 py-1 text-sm" onClick={() => setStep(1)}>
              Change Country
            </button>
          </div>

          {pricing ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm text-blue-800">Amount to Pay</div>
              <div className="text-2xl font-bold text-blue-900">{pricing.formatted}</div>
              <div className="text-xs text-blue-600">
                ≈ ${pricing.usdEquivalent} USD
                {pricing.note ? ` • ${pricing.note}` : ''}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`flex cursor-pointer items-center space-x-3 rounded-lg border-2 p-4 hover:border-blue-500 ${
                  method.recommended ? 'border-green-500 bg-green-50' : ''
                }`}
                onClick={() => handlePaymentMethodSelect(method.id)}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={paymentMethod === method.id}
                  onChange={() => handlePaymentMethodSelect(method.id)}
                />
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{method.icon}</span>
                    <span className="font-semibold">{method.name}</span>
                    {method.recommended ? (
                      <span className="rounded bg-green-600 px-2 py-1 text-xs text-white">Recommended</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {method.type === 'mobile_money' ? 'Instant payment via mobile money' : ''}
                    {method.type === 'card' ? 'Pay with Visa or Mastercard' : ''}
                    {method.type === 'bank' ? 'Direct bank transfer' : ''}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payment Details</h3>
            <button type="button" className="rounded border border-border px-3 py-1 text-sm" onClick={() => setStep(2)}>
              Change Method
            </button>
          </div>

          {pricing ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-blue-800">{paymentMethods.find((m) => m.id === paymentMethod)?.name}</div>
                  <div className="text-2xl font-bold text-blue-900">{pricing.formatted}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-blue-600">
                    {pricingService.getCountryName(country)} {pricingService.getCountryFlag(country)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm">First Name</label>
              <input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="w-full rounded border border-border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm">Last Name</label>
              <input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="w-full rounded border border-border px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full rounded border border-border px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="mb-1 block text-sm">Phone Number</label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              placeholder="+254712345678"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              required
              className="w-full rounded border border-border px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">Include country code (e.g., +254 for Kenya)</p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="button" onClick={onCancel} disabled={loading} className="flex-1 rounded border border-border px-3 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
              {loading ? 'Processing...' : `Pay ${pricing?.formatted || ''}`}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

export default UnifiedPaymentForm
