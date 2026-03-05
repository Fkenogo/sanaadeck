import { useMemo } from 'react'
import creditService from '@/services/creditService'
import { COMPLEXITY_OPTIONS, DELIVERABLE_OPTIONS } from '@/utils/constants'
import { creditsToHours } from '@/utils/helpers'

function CreditEstimator({ deliverableType, complexity, onDeliverableTypeChange, onComplexityChange }) {
  const estimatedCredits = useMemo(
    () => creditService.estimateCredits(deliverableType, complexity),
    [complexity, deliverableType],
  )

  return (
    <div className="rounded border border-border p-4">
      <h3 className="text-base font-semibold">Credit Estimator</h3>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm" htmlFor="deliverableType">
            Deliverable type
          </label>
          <select
            id="deliverableType"
            value={deliverableType}
            onChange={(event) => onDeliverableTypeChange(event.target.value)}
            className="w-full rounded border border-border px-3 py-2"
          >
            {DELIVERABLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm" htmlFor="complexity">
            Complexity
          </label>
          <select
            id="complexity"
            value={complexity}
            onChange={(event) => onComplexityChange(event.target.value)}
            className="w-full rounded border border-border px-3 py-2"
          >
            {COMPLEXITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 rounded bg-muted p-3">
        <p className="text-sm">
          Estimated credits: <span className="font-semibold">{estimatedCredits}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Estimated production time: {creditsToHours(estimatedCredits)} hours
        </p>
      </div>
    </div>
  )
}

export default CreditEstimator
