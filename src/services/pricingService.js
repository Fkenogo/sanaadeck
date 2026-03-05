/**
 * SanaaDeck Pricing Service
 * Handles multi-country pricing with fixed local rates
 */

const EXCHANGE_RATES = {
  KE: {
    currency: 'KES',
    rate: 140,
    symbol: 'KSh',
    name: 'Kenyan Shilling',
    locale: 'en-KE'
  },
  UG: {
    currency: 'UGX',
    rate: 3700,
    symbol: 'USh',
    name: 'Ugandan Shilling',
    locale: 'en-UG'
  },
  RW: {
    currency: 'RWF',
    rate: 1300,
    symbol: 'FRw',
    name: 'Rwandan Franc',
    locale: 'en-RW'
  },
  BI: {
    currency: 'BIF',
    rate: 5700, // 2x official rate (2,850) for market dynamics
    symbol: 'FBu',
    name: 'Burundian Franc',
    locale: 'fr-BI',
    note: 'Market rate applied (2x official)'
  },
  TZ: {
    currency: 'TZS',
    rate: 2500,
    symbol: 'TSh',
    name: 'Tanzanian Shilling',
    locale: 'en-TZ'
  }
};

const USD_PRICES = {
  starter: 349,
  growth: 599,
  pro: 899,
  extraPack: 250
};

class PricingService {

  /**
   * Get price in local currency for a subscription tier
   * @param {string} tier - 'starter' | 'growth' | 'pro' | 'extraPack'
   * @param {string} country - 'KE' | 'UG' | 'RW' | 'BI' | 'TZ'
   * @returns {object} { amount, currency, formatted, usdEquivalent }
   * @example
   * const price = pricingService.getLocalPrice('starter', 'KE')
   * // { amount: 48860, currency: 'KES', formatted: 'KSh 48,860', usdEquivalent: 349, ... }
   */
  getLocalPrice(tier, country) {
    const usdPrice = USD_PRICES[tier];
    const exchangeInfo = EXCHANGE_RATES[country];

    if (!usdPrice) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    if (!exchangeInfo) {
      throw new Error(`Invalid country: ${country}`);
    }

    const localAmount = Math.round(usdPrice * exchangeInfo.rate);

    return {
      amount: localAmount,
      currency: exchangeInfo.currency,
      symbol: exchangeInfo.symbol,
      formatted: this.formatCurrency(localAmount, exchangeInfo),
      usdEquivalent: usdPrice,
      exchangeRate: exchangeInfo.rate,
      note: exchangeInfo.note || null
    };
  }

  /**
   * Format currency for display
   * @param {number} amount - Numeric amount in local currency.
   * @param {object} exchangeInfo - Exchange metadata from EXCHANGE_RATES.
   * @returns {string} Formatted currency string
   * @example
   * pricingService.formatCurrency(48860, { locale: 'en-KE', currency: 'KES' })
   * // 'KSh 48,860'
   */
  formatCurrency(amount, exchangeInfo) {
    return new Intl.NumberFormat(exchangeInfo.locale, {
      style: 'currency',
      currency: exchangeInfo.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get all tier prices for a country
   * @param {string} country - Country code e.g. 'KE'.
   * @returns {object} All tier prices
   * @example
   * const prices = pricingService.getAllPrices('UG')
   * // { starter: {...}, growth: {...}, pro: {...}, extraPack: {...} }
   */
  getAllPrices(country) {
    return {
      starter: this.getLocalPrice('starter', country),
      growth: this.getLocalPrice('growth', country),
      pro: this.getLocalPrice('pro', country),
      extraPack: this.getLocalPrice('extraPack', country)
    };
  }

  /**
   * Get supported countries
   * @returns {Array<{code: string, name: string, currency: string, symbol: string, flag: string}>}
   * List of countries with display metadata.
   * @example
   * const countries = pricingService.getSupportedCountries()
   * // [{ code: 'KE', name: 'Kenya', ... }, ...]
   */
  getSupportedCountries() {
    return Object.entries(EXCHANGE_RATES).map(([code, info]) => ({
      code,
      name: this.getCountryName(code),
      currency: info.currency,
      symbol: info.symbol,
      flag: this.getCountryFlag(code)
    }));
  }

  /**
   * Resolve display name for a country code.
   * @param {string} code - Country code.
   * @returns {string} Country display name or the provided code if unknown.
   * @example
   * pricingService.getCountryName('BI')
   * // 'Burundi'
   */
  getCountryName(code) {
    const names = {
      KE: 'Kenya',
      UG: 'Uganda',
      RW: 'Rwanda',
      BI: 'Burundi',
      TZ: 'Tanzania'
    };
    return names[code] || code;
  }

  /**
   * Resolve country flag emoji from country code.
   * @param {string} code - Country code.
   * @returns {string} Country flag emoji or empty string when unknown.
   * @example
   * pricingService.getCountryFlag('TZ')
   * // '🇹🇿'
   */
  getCountryFlag(code) {
    const flags = {
      KE: '🇰🇪',
      UG: '🇺🇬',
      RW: '🇷🇼',
      BI: '🇧🇮',
      TZ: '🇹🇿'
    };
    return flags[code] || '';
  }

  /**
   * Get available payment methods for a country
   * @param {string} country - Country code e.g. 'RW'.
   * @returns {Array<{id: string, name: string, type: string, icon: string, recommended?: boolean}>}
   * Payment method options ordered by preference.
   * @example
   * const methods = pricingService.getPaymentMethods('TZ')
   * // [{ id: 'mpesa', ... }, ...]
   */
  getPaymentMethods(country) {
    const methods = {
      KE: [
        { id: 'mpesa', name: 'M-Pesa', type: 'mobile_money', icon: '📱', recommended: true },
        { id: 'airtel', name: 'Airtel Money', type: 'mobile_money', icon: '📱' },
        { id: 'card', name: 'Visa/Mastercard', type: 'card', icon: '💳' },
        { id: 'bank', name: 'Bank Transfer', type: 'bank', icon: '🏦' }
      ],
      UG: [
        { id: 'mtn', name: 'MTN Mobile Money', type: 'mobile_money', icon: '📱', recommended: true },
        { id: 'airtel', name: 'Airtel Money', type: 'mobile_money', icon: '📱' },
        { id: 'card', name: 'Visa/Mastercard', type: 'card', icon: '💳' },
        { id: 'bank', name: 'Bank Transfer', type: 'bank', icon: '🏦' }
      ],
      RW: [
        { id: 'mtn', name: 'MTN Mobile Money', type: 'mobile_money', icon: '📱', recommended: true },
        { id: 'airtel', name: 'Airtel Money', type: 'mobile_money', icon: '📱' },
        { id: 'card', name: 'Visa/Mastercard', type: 'card', icon: '💳' },
        { id: 'bank', name: 'Bank Transfer', type: 'bank', icon: '🏦' }
      ],
      BI: [
        { id: 'ecocash', name: 'Ecocash', type: 'mobile_money', icon: '📱', recommended: true },
        { id: 'card', name: 'Visa/Mastercard', type: 'card', icon: '💳' },
        { id: 'bank', name: 'Bank Transfer', type: 'bank', icon: '🏦' }
      ],
      TZ: [
        { id: 'mpesa', name: 'M-Pesa (Vodacom)', type: 'mobile_money', icon: '📱', recommended: true },
        { id: 'airtel', name: 'Airtel Money', type: 'mobile_money', icon: '📱' },
        { id: 'tigo', name: 'Tigo Pesa', type: 'mobile_money', icon: '📱' },
        { id: 'halopesa', name: 'Halopesa', type: 'mobile_money', icon: '📱' },
        { id: 'card', name: 'Visa/Mastercard', type: 'card', icon: '💳' },
        { id: 'bank', name: 'Bank Transfer', type: 'bank', icon: '🏦' }
      ]
    };

    return methods[country] || methods.KE;
  }
}

export default new PricingService();
