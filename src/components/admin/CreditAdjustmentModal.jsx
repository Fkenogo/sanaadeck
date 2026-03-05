import { useState } from 'react'

function CreditAdjustmentModal({ open, client, onClose, onSubmit, submitting }) {
  const [mode, setMode] = useState(client?.adjustmentPreset?.mode === 'deduct' ? 'deduct' : 'add')
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState(client?.adjustmentPreset?.reason || '')
  const [error, setError] = useState('')

  if (!open || !client) return null

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    try {
      await onSubmit({
        clientId: client.id,
        mode,
        amount: Number(amount),
        reason,
      })
      setReason('')
      setAmount(1)
      setMode('add')
      onClose()
    } catch (submitError) {
      setError(submitError?.message || 'Failed to adjust credits')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Adjust Credits</h2>
          <button className="text-sm underline" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">Client: {client.businessName || client.email || 'Unknown client'}</p>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm" htmlFor="mode">
              Mode
            </label>
            <select id="mode" value={mode} onChange={(event) => setMode(event.target.value)} className="w-full rounded border border-border px-3 py-2">
              <option value="add">Add credits</option>
              <option value="deduct">Deduct credits</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded border border-border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm" htmlFor="reason">
              Reason
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded border border-border px-3 py-2"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit" disabled={submitting}>
            {submitting ? 'Applying...' : 'Apply adjustment'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CreditAdjustmentModal
