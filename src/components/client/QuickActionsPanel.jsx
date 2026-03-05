import { useEffect, useMemo, useState } from 'react'
import clientService from '@/services/clientService'
import { TIER_BY_KEY } from '@/utils/constants'
import FileUploader from '@/components/common/FileUploader'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'Unknown'
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString()
}

function formatProviderLabel(provider) {
  const normalized = String(provider || '').trim().toLowerCase()
  if (!normalized || normalized === 'pesapal') return 'Pesapal'
  return normalized.toUpperCase()
}

function QuickActionsPanel({ clientId, currentTier, brandAssets, onBuyExtraCredits, onCheckoutSubscription, onClientDataRefresh }) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showBilling, setShowBilling] = useState(false)
  const [showBrandAssets, setShowBrandAssets] = useState(false)
  const [payments, setPayments] = useState([])
  const [tierDraft, setTierDraft] = useState(currentTier || 'starter')
  const [brandDraft, setBrandDraft] = useState({
    logos: (brandAssets?.logos || []).join(', '),
    colors: (brandAssets?.colors || []).join(', '),
    fonts: (brandAssets?.fonts || []).join(', '),
    guidelines: brandAssets?.guidelines || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [logoUploads, setLogoUploads] = useState([])
  const [fontUploads, setFontUploads] = useState([])
  const [guidelineUploads, setGuidelineUploads] = useState([])

  useEffect(() => {
    setTierDraft(currentTier || 'starter')
  }, [currentTier])

  useEffect(() => {
    setBrandDraft({
      logos: (brandAssets?.logos || []).join(', '),
      colors: (brandAssets?.colors || []).join(', '),
      fonts: (brandAssets?.fonts || []).join(', '),
      guidelines: brandAssets?.guidelines || '',
    })
  }, [brandAssets])

  useEffect(() => {
    if (!clientId || !showBilling) return undefined

    const unsubscribe = clientService.subscribeToPayments(
      clientId,
      (records) => setPayments(records),
      (subscriptionError) => {
        console.error('[QuickActionsPanel] Failed to load billing history:', subscriptionError)
      },
    )

    return unsubscribe
  }, [clientId, showBilling])

  const currentTierLabel = useMemo(() => (currentTier || 'starter').toUpperCase(), [currentTier])

  function handleUpgradeCheckout() {
    setError('')
    setShowUpgrade(false)
    if (typeof onCheckoutSubscription === 'function') {
      onCheckoutSubscription(tierDraft)
    }
  }

  async function handleSaveBrandAssets() {
    setError('')
    setBusy(true)

    const mergedLogos = [
      ...brandDraft.logos.split(',').map((item) => item.trim()).filter(Boolean),
      ...logoUploads.map((item) => item.url).filter(Boolean),
    ]
    const mergedFonts = [
      ...brandDraft.fonts.split(',').map((item) => item.trim()).filter(Boolean),
      ...fontUploads.map((item) => item.url).filter(Boolean),
    ]
    const mergedGuidelines = [
      ...guidelineUploads.map((item) => item.url).filter(Boolean),
      brandDraft.guidelines.trim(),
    ].filter(Boolean)

    const payload = {
      logos: [...new Set(mergedLogos)],
      colors: brandDraft.colors.split(',').map((item) => item.trim()).filter(Boolean),
      fonts: [...new Set(mergedFonts)],
      guidelines: mergedGuidelines[0] || null,
      guidelineFiles: mergedGuidelines,
    }

    try {
      await clientService.updateBrandAssets(clientId, payload)
      setShowBrandAssets(false)
      if (onClientDataRefresh) onClientDataRefresh()
    } catch (saveError) {
      setError(saveError?.message || 'Failed to update brand assets')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Quick Actions</h2>
        <p className="text-sm text-muted-foreground">Current tier: {currentTierLabel}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => setShowUpgrade(true)}>
          Upgrade subscription
        </button>
        <button className="rounded border border-border px-3 py-2 text-sm" onClick={onBuyExtraCredits}>
          Purchase extra credits
        </button>
        <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => setShowBilling(true)}>
          View billing history
        </button>
      <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => setShowBrandAssets(true)}>
        Update brand assets
      </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {showUpgrade ? (
        <Modal title="Upgrade Subscription" onClose={() => setShowUpgrade(false)}>
          <p className="mb-3 text-sm text-muted-foreground">Select a subscription tier.</p>
          <select value={tierDraft} onChange={(event) => setTierDraft(event.target.value)} className="w-full rounded border border-border px-3 py-2">
            {Object.values(TIER_BY_KEY).map((tier) => (
              <option key={tier.key} value={tier.key}>
                {tier.key.toUpperCase()} · {tier.creditsPerMonth} credits · ${tier.priceUsd}/month
              </option>
            ))}
          </select>
          <button className="mt-3 rounded bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={handleUpgradeCheckout} disabled={busy}>
            Continue to checkout
          </button>
        </Modal>
      ) : null}

      {showBilling ? (
        <Modal title="Billing History" onClose={() => setShowBilling(false)}>
          <div className="max-h-80 space-y-2 overflow-auto text-sm">
            {payments.length > 0 ? (
              payments.map((payment) => (
                <div key={payment.id} className="rounded border border-border p-2">
                  <p className="font-medium">{formatProviderLabel(payment.provider)} · {payment.status}</p>
                  <p>Amount: {payment.currency || 'USD'} {payment.amount}</p>
                  <p>Date: {formatDate(payment.createdAt)}</p>
                  <p className="text-muted-foreground">Reason: {payment.reason}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No billing records yet.</p>
            )}
          </div>
        </Modal>
      ) : null}

      {showBrandAssets ? (
        <Modal title="Update Brand Assets" onClose={() => setShowBrandAssets(false)}>
          <div className="space-y-2 text-sm">
            <label className="block">
              Logos (comma separated URLs)
              <input
                value={brandDraft.logos}
                onChange={(event) => setBrandDraft((prev) => ({ ...prev, logos: event.target.value }))}
                className="mt-1 w-full rounded border border-border px-3 py-2"
              />
            </label>
            <FileUploader
              multiple
              storagePath={`brand-assets/${clientId}/logos`}
              acceptedTypes={['image/png', 'image/jpeg', 'image/svg+xml']}
              onChange={setLogoUploads}
              initialFiles={logoUploads}
            />
            <label className="block">
              Colors (comma separated, e.g. #111111, #00A699)
              <input
                value={brandDraft.colors}
                onChange={(event) => setBrandDraft((prev) => ({ ...prev, colors: event.target.value }))}
                className="mt-1 w-full rounded border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              Fonts (comma separated)
              <input
                value={brandDraft.fonts}
                onChange={(event) => setBrandDraft((prev) => ({ ...prev, fonts: event.target.value }))}
                className="mt-1 w-full rounded border border-border px-3 py-2"
              />
            </label>
            <FileUploader
              multiple
              storagePath={`brand-assets/${clientId}/fonts`}
              acceptedTypes={['font/ttf', 'font/otf', '.ttf', '.otf', '.woff', '.woff2']}
              onChange={setFontUploads}
              initialFiles={fontUploads}
            />
            <label className="block">
              Guidelines URL
              <input
                value={brandDraft.guidelines}
                onChange={(event) => setBrandDraft((prev) => ({ ...prev, guidelines: event.target.value }))}
                className="mt-1 w-full rounded border border-border px-3 py-2"
              />
            </label>
            <FileUploader
              multiple
              storagePath={`brand-assets/${clientId}/guidelines`}
              acceptedTypes={['application/pdf', 'image/png', 'image/jpeg']}
              onChange={setGuidelineUploads}
              initialFiles={guidelineUploads}
            />
            <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={handleSaveBrandAssets} disabled={busy}>
              {busy ? 'Saving...' : 'Save brand assets'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

export default QuickActionsPanel
