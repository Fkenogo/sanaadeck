# SanaaDeck - Pesapal Payment Integration Guide
## Complete Multi-Country Mobile Money & Card Payment Solution

---

## OVERVIEW

**Payment Gateway:** Pesapal (ONLY)  
**Countries Supported:** Kenya, Uganda, Rwanda, Burundi, Tanzania  
**Payment Methods:** Mobile Money (All providers), Cards (Visa/Mastercard), Bank Transfers  
**Pricing Strategy:** Fixed local pricing with 2x official rate for Burundi

---

## 1. FIXED LOCAL PRICING

### Subscription Tiers - Local Currency Pricing

#### 🟢 STARTER PLAN ($349 USD equivalent)

| Country | Currency | Price | Monthly | Payment Methods Available |
|---------|----------|-------|---------|---------------------------|
| **Kenya** | KES | **48,860** | 48,860 KES | M-Pesa, Airtel Money, Cards, Bank |
| **Uganda** | UGX | **1,291,300** | 1.29M UGX | MTN MoMo, Airtel Money, Cards, Bank |
| **Rwanda** | RWF | **453,700** | 453,700 RWF | MTN MoMo, Airtel Money, Cards, Bank |
| **Burundi** | BIF | **1,989,300** | 1.99M BIF* | Ecocash, Cards, Bank |
| **Tanzania** | TZS | **872,500** | 872,500 TZS | M-Pesa, Airtel Money, Tigo Pesa, Vodacom, Cards, Bank |

*Burundi: 2x official exchange rate (5,700 BIF/USD vs 2,850 official)

---

#### 🔵 GROWTH PLAN ($599 USD equivalent)

| Country | Currency | Price | Monthly | Payment Methods Available |
|---------|----------|-------|---------|---------------------------|
| **Kenya** | KES | **83,860** | 83,860 KES | M-Pesa, Airtel Money, Cards, Bank |
| **Uganda** | UGX | **2,216,300** | 2.22M UGX | MTN MoMo, Airtel Money, Cards, Bank |
| **Rwanda** | RWF | **778,700** | 778,700 RWF | MTN MoMo, Airtel Money, Cards, Bank |
| **Burundi** | BIF | **3,414,300** | 3.41M BIF* | Ecocash, Cards, Bank |
| **Tanzania** | TZS | **1,497,500** | 1.50M TZS | M-Pesa, Airtel Money, Tigo Pesa, Vodacom, Cards, Bank |

---

#### 🟣 PRO PLAN ($899 USD equivalent)

| Country | Currency | Price | Monthly | Payment Methods Available |
|---------|----------|-------|---------|---------------------------|
| **Kenya** | KES | **125,860** | 125,860 KES | M-Pesa, Airtel Money, Cards, Bank |
| **Uganda** | UGX | **3,326,300** | 3.33M UGX | MTN MoMo, Airtel Money, Cards, Bank |
| **Rwanda** | RWF | **1,168,700** | 1.17M RWF | MTN MoMo, Airtel Money, Cards, Bank |
| **Burundi** | BIF | **5,124,300** | 5.12M BIF* | Ecocash, Cards, Bank |
| **Tanzania** | TZS | **2,247,500** | 2.25M TZS | M-Pesa, Airtel Money, Tigo Pesa, Vodacom, Cards, Bank |

---

### Exchange Rates Used (Fixed)

```javascript
const EXCHANGE_RATES = {
  KE: { currency: 'KES', rate: 140, name: 'Kenyan Shilling' },
  UG: { currency: 'UGX', rate: 3700, name: 'Ugandan Shilling' },
  RW: { currency: 'RWF', rate: 1300, name: 'Rwandan Franc' },
  BI: { currency: 'BIF', rate: 5700, name: 'Burundian Franc', note: '2x official rate for market dynamics' },
  TZ: { currency: 'TZS', rate: 2500, name: 'Tanzanian Shilling' }
};
```

---

### Extra Credit Pack Pricing ($250 USD = 10 credits)

| Country | Currency | Price per Pack |
|---------|----------|----------------|
| Kenya | KES | 35,000 |
| Uganda | UGX | 925,000 |
| Rwanda | RWF | 325,000 |
| Burundi | BIF | 1,425,000 |
| Tanzania | TZS | 625,000 |

---

## 2. PESAPAL PAYMENT METHODS BY COUNTRY

### Kenya 🇰🇪
- **M-Pesa** (Primary - 70% market share)
- **Airtel Money**
- **Visa/Mastercard**
- **Bank Transfer**

### Uganda 🇺🇬
- **MTN Mobile Money** (Primary - 60% market share)
- **Airtel Money**
- **Visa/Mastercard**
- **Bank Transfer**

### Rwanda 🇷🇼
- **MTN Mobile Money** (Primary - 75% market share)
- **Airtel Money**
- **Visa/Mastercard**
- **Bank Transfer**

### Burundi 🇧🇮
- **Ecocash** (Primary mobile money)
- **Visa/Mastercard**
- **Bank Transfer**

### Tanzania 🇹🇿
- **M-Pesa** (Vodacom)
- **Airtel Money**
- **Tigo Pesa**
- **Halopesa (Halotel)**
- **Visa/Mastercard**
- **Bank Transfer**

---

## 3. PRICING SERVICE IMPLEMENTATION

### File: `/src/services/pricingService.js`

```javascript
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
   * @param {number} amount 
   * @param {object} exchangeInfo 
   * @returns {string} Formatted currency string
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
   * @param {string} country 
   * @returns {object} All tier prices
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
   * @returns {array} List of countries with details
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
   * Get country name from code
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
   * Get country flag emoji
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
   * @param {string} country 
   * @returns {array} Payment method options
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
```

---

## 4. PESAPAL INTEGRATION (CLOUD FUNCTION)

### File: `/functions/payments/pesapal.js`

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Pesapal Configuration
const PESAPAL_CONSUMER_KEY = functions.config().pesapal.consumer_key;
const PESAPAL_CONSUMER_SECRET = functions.config().pesapal.consumer_secret;
const PESAPAL_ENV = functions.config().pesapal.env || 'live'; // 'live' or 'sandbox'

const PESAPAL_API_URL = PESAPAL_ENV === 'live'
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3';

/**
 * Get Pesapal authentication token
 */
async function getPesapalAuthToken() {
  try {
    const response = await axios.post(`${PESAPAL_API_URL}/api/Auth/RequestToken`, {
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    return response.data.token;
  } catch (error) {
    console.error('Pesapal auth error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Pesapal');
  }
}

/**
 * Register IPN URL (run once during setup)
 */
exports.registerPesapalIPN = functions.https.onRequest(async (req, res) => {
  try {
    const token = await getPesapalAuthToken();
    const ipnUrl = `${functions.config().app.url}/api/pesapal-ipn`;
    
    const response = await axios.post(
      `${PESAPAL_API_URL}/api/URLSetup/RegisterIPN`,
      {
        url: ipnUrl,
        ipn_notification_type: 'POST'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('IPN registered:', response.data);
    
    res.json({ 
      success: true, 
      ipn_id: response.data.ipn_id,
      url: ipnUrl 
    });
  } catch (error) {
    console.error('IPN registration error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Initiate Pesapal payment (Callable Function)
 */
exports.initiatePesapalPayment = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { 
    clientId, 
    amount, 
    currency, 
    email, 
    phoneNumber, 
    firstName,
    lastName,
    reason,
    country,
    tier,
    paymentType // 'subscription' | 'extra_credits' | 'one_off_bundle'
  } = data;
  
  // Validate inputs
  if (!clientId || !amount || !currency || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  
  try {
    const token = await getPesapalAuthToken();
    
    // Create payment record first
    const paymentRef = admin.firestore().collection('payments').doc();
    const paymentId = paymentRef.id;
    
    // Prepare order request
    const orderRequest = {
      id: paymentId, // Use Firestore payment ID as merchant reference
      currency: currency,
      amount: parseFloat(amount),
      description: reason || `SanaaDeck ${tier || 'Subscription'}`,
      callback_url: `${functions.config().app.url}/payment-success?payment_id=${paymentId}`,
      notification_id: functions.config().pesapal.ipn_id,
      billing_address: {
        email_address: email,
        phone_number: phoneNumber || '',
        country_code: country || 'KE',
        first_name: firstName || email.split('@')[0],
        last_name: lastName || '',
        line_1: '',
        line_2: '',
        city: '',
        state: '',
        postal_code: '',
        zip_code: ''
      }
    };
    
    console.log('Submitting Pesapal order:', orderRequest);
    
    // Submit order to Pesapal
    const response = await axios.post(
      `${PESAPAL_API_URL}/api/Transactions/SubmitOrderRequest`,
      orderRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Pesapal response:', response.data);
    
    // Save payment record
    await paymentRef.set({
      paymentId,
      clientId,
      type: paymentType,
      tier: tier || null,
      amount,
      currency,
      country: country || null,
      paymentMethod: 'pesapal',
      provider: 'pesapal',
      transactionRef: response.data.order_tracking_id,
      merchantRef: response.data.merchant_reference,
      status: 'pending',
      callbackReceived: false,
      initiatedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      providerResponse: response.data,
      email,
      phoneNumber: phoneNumber || null
    });
    
    return {
      success: true,
      paymentId,
      redirectUrl: response.data.redirect_url,
      orderTrackingId: response.data.order_tracking_id,
      message: 'Payment initiated. Redirecting to Pesapal...'
    };
    
  } catch (error) {
    console.error('Pesapal payment error:', error.response?.data || error.message);
    throw new functions.https.HttpsError('internal', `Payment initiation failed: ${error.message}`);
  }
});

/**
 * Pesapal IPN (Instant Payment Notification) Handler
 */
exports.pesapalIPN = functions.https.onRequest(async (req, res) => {
  console.log('Pesapal IPN received:', JSON.stringify(req.body));
  
  try {
    const { OrderTrackingId, OrderMerchantReference } = req.body;
    
    if (!OrderTrackingId) {
      console.error('Missing OrderTrackingId in IPN');
      return res.status(400).send('Missing OrderTrackingId');
    }
    
    // Get auth token
    const token = await getPesapalAuthToken();
    
    // Get transaction status from Pesapal
    const statusResponse = await axios.get(
      `${PESAPAL_API_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const status = statusResponse.data;
    console.log('Transaction status:', status);
    
    // Find payment record by merchant reference (our payment ID)
    const paymentId = OrderMerchantReference || status.merchant_reference;
    
    if (!paymentId) {
      console.error('Cannot find payment ID from IPN');
      return res.status(404).send('Payment ID not found');
    }
    
    const paymentRef = admin.firestore().collection('payments').doc(paymentId);
    const paymentDoc = await paymentRef.get();
    
    if (!paymentDoc.exists) {
      console.error('Payment not found:', paymentId);
      return res.status(404).send('Payment not found');
    }
    
    const paymentData = paymentDoc.data();
    
    // Check payment status
    const paymentStatus = status.payment_status_description || status.status_code;
    
    if (paymentStatus === 'Completed' || status.payment_status_code === 1) {
      // Payment successful
      await paymentRef.update({
        status: 'completed',
        completedAt: admin.firestore.Timestamp.now(),
        callbackReceived: true,
        callbackData: status,
        callbackReceivedAt: admin.firestore.Timestamp.now(),
        transactionRef: status.confirmation_code || OrderTrackingId,
        paymentMethod: status.payment_method || 'pesapal',
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log('Payment completed:', paymentId);
      
      // Process payment based on type
      if (paymentData.type === 'subscription') {
        await handleSubscriptionPayment(paymentData.clientId, paymentId, paymentData);
      } else if (paymentData.type === 'extra_credits') {
        await handleExtraCreditsPayment(paymentData.clientId, paymentId, paymentData);
      } else if (paymentData.type === 'one_off_bundle') {
        await handleOneOffBundlePayment(paymentData.clientId, paymentId, paymentData);
      }
      
      // Send success notification
      await sendPaymentNotification(
        paymentData.clientId, 
        'success', 
        paymentData.amount,
        paymentData.currency
      );
      
    } else if (paymentStatus === 'Failed' || status.payment_status_code === 2) {
      // Payment failed
      await paymentRef.update({
        status: 'failed',
        failedAt: admin.firestore.Timestamp.now(),
        callbackReceived: true,
        callbackData: status,
        callbackReceivedAt: admin.firestore.Timestamp.now(),
        failureReason: status.description || 'Payment failed',
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log('Payment failed:', paymentId);
      
      // Send failure notification
      await sendPaymentNotification(
        paymentData.clientId, 
        'failed', 
        paymentData.amount,
        paymentData.currency,
        status.description
      );
      
    } else {
      // Payment still pending or other status
      await paymentRef.update({
        callbackReceived: true,
        callbackData: status,
        callbackReceivedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log('Payment status:', paymentStatus);
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Pesapal IPN error:', error);
    res.status(500).send('Internal error');
  }
});

/**
 * Handle subscription payment completion
 */
async function handleSubscriptionPayment(clientId, paymentId, paymentData) {
  const clientRef = admin.firestore().collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error('Client not found');
  }
  
  const data = clientDoc.data();
  const subscription = data.subscription;
  
  // Extend subscription period by 30 days
  const newPeriodStart = admin.firestore.Timestamp.now();
  const newPeriodEnd = admin.firestore.Timestamp.fromMillis(
    newPeriodStart.toMillis() + (30 * 24 * 60 * 60 * 1000)
  );
  
  await clientRef.update({
    'subscription.status': 'active',
    'subscription.currentPeriodStart': newPeriodStart,
    'subscription.currentPeriodEnd': newPeriodEnd,
    'subscription.renewalDate': newPeriodEnd,
    'subscription.creditsUsed': 0,
    'subscription.creditsRemaining': subscription.creditsPerMonth,
    'updatedAt': admin.firestore.Timestamp.now()
  });
  
  // Log credit allocation
  await admin.firestore().collection('creditTransactions').add({
    clientId,
    projectId: null,
    type: 'allocation',
    creditsAmount: subscription.creditsPerMonth,
    balanceBefore: 0,
    balanceAfter: subscription.creditsPerMonth,
    description: `Monthly credit allocation: ${subscription.tier} plan - ${paymentData.currency} ${paymentData.amount}`,
    paymentId,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: 'system'
  });
  
  console.log(`Subscription renewed for client ${clientId}`);
}

/**
 * Handle extra credits payment completion
 */
async function handleExtraCreditsPayment(clientId, paymentId, paymentData) {
  const clientRef = admin.firestore().collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error('Client not found');
  }
  
  const data = clientDoc.data();
  const extraCredits = data.extraCredits || [];
  
  // Create new credit pack (10 credits)
  const newPack = {
    packId: `pack_${Date.now()}`,
    credits: 10,
    purchaseDate: admin.firestore.Timestamp.now(),
    expiryDate: admin.firestore.Timestamp.fromMillis(
      Date.now() + (30 * 24 * 60 * 60 * 1000)
    ),
    creditsUsed: 0,
    creditsRemaining: 10,
    paymentId,
    amount: paymentData.amount,
    currency: paymentData.currency
  };
  
  await clientRef.update({
    extraCredits: [...extraCredits, newPack],
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  // Log credit transaction
  await admin.firestore().collection('creditTransactions').add({
    clientId,
    projectId: null,
    type: 'extra_pack_purchase',
    creditsAmount: 10,
    packId: newPack.packId,
    expiryDate: newPack.expiryDate,
    description: `Purchased 10 extra credits - ${paymentData.currency} ${paymentData.amount}`,
    paymentId,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: 'system'
  });
  
  console.log(`Extra credits added for client ${clientId}`);
}

/**
 * Handle one-off bundle payment completion
 */
async function handleOneOffBundlePayment(clientId, paymentId, paymentData) {
  // Same as extra credits for now
  await handleExtraCreditsPayment(clientId, paymentId, paymentData);
}

/**
 * Send payment notification
 */
async function sendPaymentNotification(clientId, status, amount, currency, errorMessage = null) {
  const clientDoc = await admin.firestore().collection('clients').doc(clientId).get();
  const clientData = clientDoc.data();
  
  const userDoc = await admin.firestore().collection('users').doc(clientData.userId).get();
  const userData = userDoc.data();
  
  const title = status === 'success' 
    ? 'Payment Successful' 
    : 'Payment Failed';
  
  const message = status === 'success'
    ? `Your payment of ${currency} ${amount.toLocaleString()} has been received successfully.`
    : `Your payment of ${currency} ${amount.toLocaleString()} failed. ${errorMessage || 'Please try again.'}`;
  
  await admin.firestore().collection('notifications').add({
    notificationId: `notif_${Date.now()}`,
    userId: userData.uid,
    type: 'payment_reminder',
    title,
    message,
    channels: {
      inApp: true,
      email: true,
      sms: false
    },
    read: false,
    dismissed: false,
    emailSent: false,
    smsSent: false,
    createdAt: admin.firestore.Timestamp.now()
  });
}

/**
 * Check payment status (Callable Function)
 * Used for manual status checking
 */
exports.checkPesapalPaymentStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { orderTrackingId } = data;
  
  if (!orderTrackingId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing orderTrackingId');
  }
  
  try {
    const token = await getPesapalAuthToken();
    
    const response = await axios.get(
      `${PESAPAL_API_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    return {
      success: true,
      status: response.data
    };
    
  } catch (error) {
    console.error('Status check error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to check payment status');
  }
});
```

---

## 5. UNIFIED PAYMENT FORM COMPONENT

### File: `/src/components/payments/UnifiedPaymentForm.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import pricingService from '@/services/pricingService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const UnifiedPaymentForm = ({ 
  tier, 
  paymentType = 'subscription', // 'subscription' | 'extra_credits' | 'one_off_bundle'
  onSuccess,
  onCancel 
}) => {
  const [step, setStep] = useState(1); // 1: Country, 2: Payment Method, 3: Details, 4: Processing
  const [country, setCountry] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  });
  
  const [pricing, setPricing] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [countries] = useState(pricingService.getSupportedCountries());
  
  // Update pricing when country changes
  useEffect(() => {
    if (country) {
      const prices = pricingService.getAllPrices(country);
      setPricing(paymentType === 'extra_credits' ? prices.extraPack : prices[tier]);
      setPaymentMethods(pricingService.getPaymentMethods(country));
    }
  }, [country, tier, paymentType]);
  
  const handleCountrySelect = (selectedCountry) => {
    setCountry(selectedCountry);
    setStep(2);
  };
  
  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
    setStep(3);
  };
  
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Call Cloud Function to initiate payment
      const initiatePesapalPayment = httpsCallable(functions, 'initiatePesapalPayment');
      
      const response = await initiatePesapalPayment({
        clientId: 'current-client-id', // Get from auth context
        amount: pricing.amount,
        currency: pricing.currency,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        reason: paymentType === 'subscription' 
          ? `SanaaDeck ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`
          : 'SanaaDeck Extra Credits',
        country,
        tier: paymentType === 'subscription' ? tier : null,
        paymentType
      });
      
      if (response.data.success) {
        // Redirect to Pesapal payment page
        window.location.href = response.data.redirectUrl;
      } else {
        setError('Payment initiation failed. Please try again.');
        setLoading(false);
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };
  
  return (
    <Card className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">
        {paymentType === 'subscription' ? 'Subscribe' : 'Purchase Extra Credits'}
      </h2>
      
      {/* Step 1: Country Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Your Country</h3>
          <div className="grid grid-cols-1 gap-3">
            {countries.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCountrySelect(c.code)}
                className="flex items-center justify-between p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{c.flag}</span>
                  <div className="text-left">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-gray-500">{c.currency}</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Step 2: Payment Method Selection */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Select Payment Method</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Change Country
            </Button>
          </div>
          
          {pricing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-blue-800">Amount to Pay</div>
              <div className="text-2xl font-bold text-blue-900">{pricing.formatted}</div>
              <div className="text-xs text-blue-600">
                ≈ ${pricing.usdEquivalent} USD
                {pricing.note && ` • ${pricing.note}`}
              </div>
            </div>
          )}
          
          <RadioGroup value={paymentMethod} onValueChange={handlePaymentMethodSelect}>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer hover:border-blue-500 ${
                    method.recommended ? 'border-green-500 bg-green-50' : ''
                  }`}
                  onClick={() => handlePaymentMethodSelect(method.id)}
                >
                  <RadioGroupItem value={method.id} id={method.id} />
                  <label htmlFor={method.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{method.icon}</span>
                      <span className="font-semibold">{method.name}</span>
                      {method.recommended && (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {method.type === 'mobile_money' && 'Instant payment via mobile money'}
                      {method.type === 'card' && 'Pay with Visa or Mastercard'}
                      {method.type === 'bank' && 'Direct bank transfer'}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      )}
      
      {/* Step 3: Payment Details */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Payment Details</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              Change Method
            </Button>
          </div>
          
          {pricing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-blue-800">
                    {paymentMethods.find(m => m.id === paymentMethod)?.name}
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{pricing.formatted}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-blue-600">
                    {pricingService.getCountryName(country)} {pricingService.getCountryFlag(country)}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              placeholder="+254712345678"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +254 for Kenya)
            </p>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Processing...' : `Pay ${pricing?.formatted}`}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};

export default UnifiedPaymentForm;
```

---

## 6. TESTING MATRIX

### Pesapal Sandbox Testing

| Country | Payment Method | Test Credentials | Expected Result |
|---------|---------------|------------------|-----------------|
| **Kenya** | M-Pesa | Phone: Any valid KE number | Success |
| **Kenya** | Airtel Money | Phone: Any valid KE number | Success |
| **Kenya** | Card | Card: 4111 1111 1111 1111 | Success |
| **Uganda** | MTN MoMo | Phone: Any valid UG number | Success |
| **Uganda** | Airtel Money | Phone: Any valid UG number | Success |
| **Rwanda** | MTN MoMo | Phone: Any valid RW number | Success |
| **Burundi** | Ecocash | Phone: Any valid BI number | Success |
| **Tanzania** | M-Pesa | Phone: Any valid TZ number | Success |
| **Tanzania** | Tigo Pesa | Phone: Any valid TZ number | Success |
| **All** | Bank Transfer | Any valid email | Success |

### Pesapal Test Cards

```
Success Card:
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date

Declined Card:
Card Number: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
```

---

## 7. DEPLOYMENT CHECKLIST

### Environment Configuration

```bash
# Set Pesapal credentials in Firebase Functions
firebase functions:config:set \
  pesapal.consumer_key="YOUR_PESAPAL_CONSUMER_KEY" \
  pesapal.consumer_secret="YOUR_PESAPAL_CONSUMER_SECRET" \
  pesapal.env="live" \
  pesapal.ipn_id="YOUR_IPN_ID" \
  app.url="https://sanaadeck.com"

# View current config
firebase functions:config:get
```

### One-Time Setup Tasks

```bash
# 1. Register IPN URL (run once)
curl https://your-project.cloudfunctions.net/registerPesapalIPN

# 2. Deploy functions
firebase deploy --only functions

# 3. Test in sandbox mode first
# Set pesapal.env="sandbox" and test all payment methods

# 4. Switch to production
firebase functions:config:set pesapal.env="live"
firebase deploy --only functions
```

---

## 8. PRICING UPDATES NEEDED IN DOCUMENTS

### Update Required in Business Concept Document

Replace subscription pricing section with:

```markdown
### 🟢 STARTER PLAN

**Kenya:** KSh 48,860/month (15 credits)  
**Uganda:** USh 1,291,300/month (15 credits)  
**Rwanda:** FRw 453,700/month (15 credits)  
**Burundi:** FBu 1,989,300/month (15 credits)*  
**Tanzania:** TSh 872,500/month (15 credits)  

*Market rate applied (2x official exchange rate)
```

---

## SUMMARY

✅ **Pesapal as sole payment gateway**  
✅ **5 countries supported** (Kenya, Uganda, Rwanda, Burundi, Tanzania)  
✅ **Fixed local pricing** with 2x rate for Burundi  
✅ **Unified payment form** - single checkout experience  
✅ **All payment methods** available freely  
✅ **Complete Cloud Function** implementation  
✅ **Testing matrix** for all scenarios  

**Ready to implement!** 🚀
