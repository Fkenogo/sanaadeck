import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import paymentService from '@/services/paymentService'

const STATUS = {
  LOADING: 'loading',
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  ERROR: 'error',
}

const SUCCESS_RAW = new Set(['completed', 'success', 'paid'])
const FAILED_RAW = new Set(['failed', 'cancelled', 'canceled', 'error', 'invalid'])
const PENDING_RAW = new Set(['pending', 'processing', 'initiated'])

function normalizePaymentStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (SUCCESS_RAW.has(s)) return STATUS.SUCCESS
  if (FAILED_RAW.has(s)) return STATUS.FAILED
  if (PENDING_RAW.has(s)) return STATUS.PENDING
  return null
}

const VERIFICATION_TIMEOUT_MS = 15_000

function StatusIcon({ status }) {
  if (status === STATUS.LOADING) {
    return (
      <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin mx-auto" />
    )
  }

  if (status === STATUS.SUCCESS) {
    return (
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }

  if (status === STATUS.FAILED) {
    return (
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  }

  return (
    <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
      <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

const TITLE = {
  [STATUS.LOADING]: 'Verifying payment…',
  [STATUS.SUCCESS]: 'Payment successful',
  [STATUS.FAILED]: 'Payment failed',
  [STATUS.PENDING]: 'Payment pending',
  [STATUS.ERROR]: 'Something went wrong',
}

const SUBTITLE = {
  [STATUS.LOADING]: 'Please wait while we confirm your payment.',
  [STATUS.SUCCESS]: 'Your payment has been confirmed and your credits have been updated.',
  [STATUS.FAILED]: 'Your payment was not completed. No charges were made.',
  [STATUS.PENDING]: 'Your payment is being processed. This may take a few minutes.',
  [STATUS.ERROR]: 'We could not verify your payment. Please contact support if the issue persists.',
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { userProfile } = useAuth()

  const orderTrackingId = searchParams.get('OrderTrackingId')
  const orderMerchantReference = searchParams.get('OrderMerchantReference')
  const pesapalStatus = searchParams.get('status')
  const pesapalMessage = searchParams.get('message')

  const [status, setStatus] = useState(STATUS.LOADING)
  const [paymentData, setPaymentData] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const unsubscribeRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    // Fallback: if still loading after timeout, resolve to pending.
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setStatus((prev) => (prev === STATUS.LOADING ? STATUS.PENDING : prev))
      }
    }, VERIFICATION_TIMEOUT_MS)

    async function verify() {
      // No tracking ID — resolve immediately from URL status param.
      if (!orderTrackingId) {
        const resolved = normalizePaymentStatus(pesapalStatus)
        if (resolved === STATUS.SUCCESS || resolved === STATUS.FAILED || resolved === STATUS.PENDING) {
          setStatus(resolved)
        } else {
          setStatus(STATUS.ERROR)
          setErrorMessage('No payment tracking ID was provided.')
        }
        return
      }

      try {
        const result = await paymentService.verifyPesapalPaymentStatus(orderTrackingId)

        if (cancelled) return

        const paymentId = result?.paymentId || orderMerchantReference

        if (paymentId) {
          unsubscribeRef.current = paymentService.subscribeToPayment(
            paymentId,
            (data) => {
              if (cancelled) return
              setPaymentData(data)

              if (!data) {
                // Doc not found yet — stay pending; timeout will resolve if needed.
                setStatus(STATUS.PENDING)
                return
              }

              const resolved = normalizePaymentStatus(data.status) ?? STATUS.PENDING
              setStatus(resolved)
            },
            (err) => {
              if (cancelled) return
              setStatus(STATUS.ERROR)
              setErrorMessage(err?.message || 'Failed to load payment details.')
            },
          )
        } else {
          // No paymentId available — resolve from callable result status.
          const resolved = normalizePaymentStatus(result?.status) ?? STATUS.PENDING
          setStatus(resolved)
        }
      } catch (err) {
        if (cancelled) return
        setStatus(STATUS.ERROR)
        setErrorMessage(err?.message || 'Verification failed.')
      }
    }

    verify()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [orderTrackingId, orderMerchantReference, pesapalStatus])

  // "Go to Credits" is the credits page which is also the checkout entry for this app.
  // Show it only for client role on success. Admin/super_admin see dashboard only.
  const isClient = userProfile?.role === 'client'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <StatusIcon status={status} />
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {TITLE[status]}
        </h1>

        <p className="text-gray-500 mb-2">
          {SUBTITLE[status]}
        </p>

        {pesapalMessage && status !== STATUS.SUCCESS && (
          <p className="text-sm text-gray-400 mt-1 mb-2 italic">"{pesapalMessage}"</p>
        )}

        {errorMessage && (
          <p className="text-sm text-red-500 mt-2 mb-2">{errorMessage}</p>
        )}

        {paymentData?.amount && status === STATUS.SUCCESS && (
          <p className="text-sm text-gray-500 mt-1 mb-2">
            Amount: {paymentData.currency || 'USD'} {paymentData.amount}
          </p>
        )}

        {status !== STATUS.LOADING && (
          <div className="mt-8 flex flex-col gap-3">
            {isClient && status === STATUS.SUCCESS && (
              <button
                onClick={() => navigate('/credits')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
              >
                Go to Credits
              </button>
            )}

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-xl transition-colors"
            >
              Go to Dashboard
            </button>

            {status === STATUS.FAILED && isClient && (
              <button
                onClick={() => navigate('/credits')}
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium py-3 px-6 rounded-xl transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
