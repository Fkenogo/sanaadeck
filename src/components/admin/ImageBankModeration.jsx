import { useMemo, useState } from 'react'
import { formatDate } from '@/utils/timestamp'

function ImageBankModeration({ assets = [], onApprove, onReject }) {
  const pending = useMemo(() => assets.filter((asset) => asset.status === 'pending'), [assets])
  const reviewed = useMemo(() => assets.filter((asset) => asset.status === 'approved' || asset.status === 'rejected'), [assets])
  const [checkStateByAssetId, setCheckStateByAssetId] = useState({})
  const [rejectionReasonByAssetId, setRejectionReasonByAssetId] = useState({})

  function getChecks(assetId) {
    return checkStateByAssetId[assetId] || {
      rightsChecked: false,
      appropriatenessChecked: false,
      qualityChecked: false,
      reusableChecked: false,
    }
  }

  function setCheck(assetId, key, value) {
    setCheckStateByAssetId((prev) => ({
      ...prev,
      [assetId]: {
        ...getChecks(assetId),
        [key]: Boolean(value),
      },
    }))
  }

  function canApprove(assetId) {
    const checks = getChecks(assetId)
    return checks.rightsChecked && checks.appropriatenessChecked && checks.qualityChecked && checks.reusableChecked
  }

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Image Moderation</h2>
      <p className="mt-1 text-sm text-muted-foreground">Approve or reject creative image submissions.</p>

      <div className="mt-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Pending ({pending.length})</h3>
          <div className="mt-2 max-h-80 space-y-2 overflow-auto">
            {pending.length > 0 ? (
              pending.map((asset) => (
                <div key={asset.id} className="rounded border border-border p-3 text-sm">
                  <p className="font-medium">{asset.title}</p>
                  <a href={asset.assetUrl} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">
                    {asset.assetUrl}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creative: {asset.creativeId || 'unknown'} · {formatDate(asset.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    rightsConfirmed: {String(asset.rightsConfirmed)} · licenseType: {asset.licenseType || '-'} · usageCount: {Number(asset.usageCount || 0)}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-zinc-300 md:grid-cols-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={getChecks(asset.id).rightsChecked}
                        onChange={(event) => setCheck(asset.id, 'rightsChecked', event.target.checked)}
                      />
                      rights checked
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={getChecks(asset.id).appropriatenessChecked}
                        onChange={(event) => setCheck(asset.id, 'appropriatenessChecked', event.target.checked)}
                      />
                      appropriateness checked
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={getChecks(asset.id).qualityChecked}
                        onChange={(event) => setCheck(asset.id, 'qualityChecked', event.target.checked)}
                      />
                      quality checked
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={getChecks(asset.id).reusableChecked}
                        onChange={(event) => setCheck(asset.id, 'reusableChecked', event.target.checked)}
                      />
                      reusable for platform checked
                    </label>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded border border-border px-2 py-1 text-xs"
                    rows={2}
                    value={rejectionReasonByAssetId[asset.id] || ''}
                    onChange={(event) => setRejectionReasonByAssetId((prev) => ({ ...prev, [asset.id]: event.target.value }))}
                    placeholder="Optional rejection reason"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      onClick={() => onApprove(asset.id, getChecks(asset.id))}
                      disabled={!canApprove(asset.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded border border-border px-2 py-1 text-xs"
                      onClick={() => onReject(asset.id, rejectionReasonByAssetId[asset.id] || '', getChecks(asset.id))}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No pending assets.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Reviewed ({reviewed.length})</h3>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.length > 0 ? (
                  reviewed.map((asset) => (
                    <tr key={asset.id} className="border-b border-border/60">
                      <td className="px-2 py-2">{asset.title}</td>
                      <td className="px-2 py-2">{asset.status}</td>
                      <td className="px-2 py-2">{formatDate(asset.reviewedAt || asset.updatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} className="px-2 py-4 text-muted-foreground">No moderated assets yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ImageBankModeration
