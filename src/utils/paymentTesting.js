/**
 * Payment testing fixtures for Pesapal sandbox flows.
 * Aligned to PESAPAL-PAYMENT-INTEGRATION-GUIDE.md Section 6.
 */

export const TEST_COUNTRIES = [
  {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    paymentMethods: ['mpesa', 'airtel', 'card', 'bank'],
  },
  {
    code: 'UG',
    name: 'Uganda',
    currency: 'UGX',
    paymentMethods: ['mtn', 'airtel', 'card', 'bank'],
  },
  {
    code: 'RW',
    name: 'Rwanda',
    currency: 'RWF',
    paymentMethods: ['mtn', 'airtel', 'card', 'bank'],
  },
  {
    code: 'BI',
    name: 'Burundi',
    currency: 'BIF',
    paymentMethods: ['ecocash', 'card', 'bank'],
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    currency: 'TZS',
    paymentMethods: ['mpesa', 'airtel', 'tigo', 'halopesa', 'card', 'bank'],
  },
]

export const PESAPAL_SANDBOX_CREDENTIALS = {
  apiBaseUrl: 'https://cybqa.pesapal.com/pesapalv3',
  consumerKey: 'YOUR_PESAPAL_SANDBOX_KEY',
  consumerSecret: 'YOUR_PESAPAL_SANDBOX_SECRET',
  note: 'Set real values in Firebase Functions config: pesapal.consumer_key / pesapal.consumer_secret',
}

export const TEST_CARDS = {
  success: {
    cardNumber: '4111 1111 1111 1111',
    cvv: 'Any 3 digits',
    expiry: 'Any future date',
  },
  declined: {
    cardNumber: '4000 0000 0000 0002',
    cvv: 'Any 3 digits',
    expiry: 'Any future date',
  },
}

export const MOCK_PAYMENT_SCENARIOS = {
  success: {
    provider: 'pesapal',
    status: 'completed',
    paymentStatusCode: 1,
    paymentStatusDescription: 'Completed',
    orderTrackingId: 'PESAPAL_TRACKING_SUCCESS_001',
    merchantReference: 'mock_payment_success_001',
  },
  failed: {
    provider: 'pesapal',
    status: 'failed',
    paymentStatusCode: 2,
    paymentStatusDescription: 'Failed',
    orderTrackingId: 'PESAPAL_TRACKING_FAILED_001',
    merchantReference: 'mock_payment_failed_001',
    reason: 'Insufficient funds',
  },
  pending: {
    provider: 'pesapal',
    status: 'pending',
    paymentStatusCode: 0,
    paymentStatusDescription: 'Pending',
    orderTrackingId: 'PESAPAL_TRACKING_PENDING_001',
    merchantReference: 'mock_payment_pending_001',
  },
}

export const TEST_SCENARIOS = {
  kenya_mpesa: {
    country: 'KE',
    paymentMethod: 'mpesa',
    phoneNumber: '+254712345678',
    tier: 'starter',
    expectedAmount: 48860,
    expectedCurrency: 'KES',
  },
  kenya_card: {
    country: 'KE',
    paymentMethod: 'card',
    phoneNumber: '+254712345678',
    tier: 'growth',
    expectedAmount: 83860,
    expectedCurrency: 'KES',
    card: TEST_CARDS.success,
  },
  uganda_mtn: {
    country: 'UG',
    paymentMethod: 'mtn',
    phoneNumber: '+256712345678',
    tier: 'growth',
    expectedAmount: 2216300,
    expectedCurrency: 'UGX',
  },
  rwanda_mtn: {
    country: 'RW',
    paymentMethod: 'mtn',
    phoneNumber: '+250712345678',
    tier: 'pro',
    expectedAmount: 1168700,
    expectedCurrency: 'RWF',
  },
  burundi_ecocash: {
    country: 'BI',
    paymentMethod: 'ecocash',
    phoneNumber: '+25771234567',
    tier: 'starter',
    expectedAmount: 1989300,
    expectedCurrency: 'BIF',
  },
  tanzania_tigo: {
    country: 'TZ',
    paymentMethod: 'tigo',
    phoneNumber: '+255712345678',
    tier: 'starter',
    expectedAmount: 872500,
    expectedCurrency: 'TZS',
  },
  tanzania_mpesa: {
    country: 'TZ',
    paymentMethod: 'mpesa',
    phoneNumber: '+255712345678',
    tier: 'pro',
    expectedAmount: 2247500,
    expectedCurrency: 'TZS',
  },
  extra_pack_kenya: {
    country: 'KE',
    paymentMethod: 'mpesa',
    phoneNumber: '+254712345678',
    tier: 'extraPack',
    expectedAmount: 35000,
    expectedCurrency: 'KES',
  },
  extra_pack_burundi: {
    country: 'BI',
    paymentMethod: 'ecocash',
    phoneNumber: '+25771234567',
    tier: 'extraPack',
    expectedAmount: 1425000,
    expectedCurrency: 'BIF',
  },
}

/**
 * Fetch a single payment scenario by key.
 * @param {string} key - Scenario key from TEST_SCENARIOS.
 * @returns {object|null} Scenario object or null when not found.
 * @example
 * const scenario = getScenario('kenya_mpesa')
 * // { country: 'KE', paymentMethod: 'mpesa', ... }
 */
export function getScenario(key) {
  return TEST_SCENARIOS[key] || null
}

/**
 * List all available test scenario keys.
 * @returns {string[]} Scenario key list.
 * @example
 * const keys = listScenarioKeys()
 * // ['kenya_mpesa', 'uganda_mtn', ...]
 */
export function listScenarioKeys() {
  return Object.keys(TEST_SCENARIOS)
}

export default {
  TEST_COUNTRIES,
  PESAPAL_SANDBOX_CREDENTIALS,
  TEST_CARDS,
  MOCK_PAYMENT_SCENARIOS,
  TEST_SCENARIOS,
  getScenario,
  listScenarioKeys,
}
