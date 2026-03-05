import pricingService from '../src/services/pricingService.js'
import { TEST_SCENARIOS } from '../src/utils/paymentTesting.js'

/**
 * Assert strict equality for test values.
 * @param {unknown} actual - Actual value from system under test.
 * @param {unknown} expected - Expected fixture value.
 * @param {string} label - Assertion label for failure output.
 * @returns {void}
 * @example
 * assertEqual(10, 10, 'amount')
 */
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

/**
 * Run pricing verification against all payment testing scenarios.
 * @returns {void}
 * @example
 * run()
 * // Logs: Verified X/X pricing scenarios successfully.
 */
function run() {
  const entries = Object.entries(TEST_SCENARIOS)
  let passed = 0

  for (const [name, scenario] of entries) {
    const result = pricingService.getLocalPrice(scenario.tier, scenario.country)

    assertEqual(result.amount, scenario.expectedAmount, `${name} amount`)
    assertEqual(result.currency, scenario.expectedCurrency, `${name} currency`)
    passed += 1
  }

  console.log(`Verified ${passed}/${entries.length} pricing scenarios successfully.`)
}

try {
  run()
} catch (error) {
  console.error('Pricing scenario verification failed:', error.message)
  process.exitCode = 1
}
