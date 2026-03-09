import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'

const EXTRA_CREDITS_PRICE_USD = 250
const EXTRA_CREDIT_PACK_SIZE = 10

class PaymentService {
  constructor() {
    this.initiatePesapalPaymentCallable = httpsCallable(functions, 'initiatePesapalPayment')
    this.checkPesapalPaymentStatusCallable = httpsCallable(functions, 'checkPesapalPaymentStatus')
    this.simulatePayments = import.meta.env.VITE_PAYMENT_SIMULATE === 'true'
  }

  async initiatePesapalPayment({ clientId, amount, reason, metadata, currency = 'USD', simulateSuccess = this.simulatePayments }) {
    const response = await this.initiatePesapalPaymentCallable({
      clientId,
      amount,
      reason,
      metadata,
      currency,
      simulateSuccess,
    })

    return response.data
  }

  subscribeToPayment(paymentId, onData, onError) {
    if (!paymentId) {
      throw new Error('paymentId is required')
    }

    return onSnapshot(
      doc(db, 'payments', paymentId),
      (snapshot) => {
        if (!snapshot.exists()) {
          onData(null)
          return
        }

        onData({ id: snapshot.id, ...snapshot.data() })
      },
      (error) => {
        if (onError) {
          onError(error)
        }
      },
    )
  }

  async getPaymentStatus(paymentId) {
    if (!paymentId) {
      throw new Error('paymentId is required')
    }

    const snapshot = await getDoc(doc(db, 'payments', paymentId))
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() }
  }

  async verifyPesapalPaymentStatus(trackingId) {
    if (!trackingId) {
      throw new Error('trackingId is required')
    }

    const response = await this.checkPesapalPaymentStatusCallable({ trackingId })
    return response.data
  }

  async purchaseExtraCredits({ clientId }) {
    return this.initiatePesapalPayment({
      clientId,
      amount: EXTRA_CREDITS_PRICE_USD,
      reason: 'extra_credits',
      metadata: {
        creditsAmount: EXTRA_CREDIT_PACK_SIZE,
      },
      currency: 'USD',
    })
  }
}

export default new PaymentService()
