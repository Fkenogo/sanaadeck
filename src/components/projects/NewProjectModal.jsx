import { useMemo, useState } from 'react'
import creditService from '@/services/creditService'
import projectService from '@/services/projectService'
import CreditEstimator from '@/components/credits/CreditEstimator'
import FileUploader from '@/components/common/FileUploader'

const initialForm = {
  deliverableType: 'social_post',
  complexity: 'standard',
  title: '',
  description: '',
  brief: '',
  deadline: '',
  referenceFiles: [],
}

function NewProjectModal({ open, onClose, clientId, createdBy, availableCredits, onProjectCreated }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const estimatedCredits = useMemo(
    () => creditService.estimateCredits(form.deliverableType, form.complexity),
    [form.complexity, form.deliverableType],
  )

  function resetState() {
    setStep(1)
    setForm(initialForm)
    setSubmitting(false)
    setError('')
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function nextStep() {
    setError('')

    if (step === 2 && !form.title.trim()) {
      setError('Project title is required.')
      return
    }

    if (step < 4) {
      setStep((prev) => prev + 1)
    }
  }

  function prevStep() {
    setError('')
    if (step > 1) {
      setStep((prev) => prev - 1)
    }
  }

  async function confirmRequest() {
    if (!clientId) {
      setError('Missing client profile. Please sign in again.')
      return
    }

    if (availableCredits < estimatedCredits) {
      setError('Insufficient credits for this request. Buy extra credits or upgrade your subscription.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const result = await projectService.createProjectWithCreditReservation({
        clientId,
        createdBy,
        title: form.title,
        deliverableType: form.deliverableType,
        complexity: form.complexity,
        description: form.description,
        brief: form.brief,
        deadline: form.deadline,
        referenceFiles: form.referenceFiles,
      })

      console.log('[NewProjectModal] Project created:', result)
      if (onProjectCreated) {
        onProjectCreated(result)
      }
      handleClose()
    } catch (submitError) {
      console.error('[NewProjectModal] Failed to create project:', submitError)
      setError(submitError?.message || 'Unable to create request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Project Request</h2>
          <button className="text-sm underline" onClick={handleClose}>
            Close
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">Step {step} of 4</p>

        <div className="mt-4">
          {step === 1 ? (
            <CreditEstimator
              deliverableType={form.deliverableType}
              complexity={form.complexity}
              onDeliverableTypeChange={(value) => updateField('deliverableType', value)}
              onComplexityChange={(value) => updateField('complexity', value)}
            />
          ) : null}

          {step === 2 ? (
            <div className="space-y-3 rounded border border-border p-4">
              <div>
                <label className="mb-1 block text-sm" htmlFor="title">
                  Project title
                </label>
                <input
                  id="title"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  className="w-full rounded border border-border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  className="w-full rounded border border-border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm" htmlFor="deadline">
                  Deadline
                </label>
                <input
                  id="deadline"
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(event) => updateField('deadline', event.target.value)}
                  className="w-full rounded border border-border px-3 py-2"
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 rounded border border-border p-4">
              <label className="mb-1 block text-sm" htmlFor="brief">
                Project brief
              </label>
              <textarea
                id="brief"
                rows={6}
                value={form.brief}
                onChange={(event) => updateField('brief', event.target.value)}
                className="w-full rounded border border-border px-3 py-2"
                placeholder="Add brand context, audience, references, and expected outcome."
              />
              <FileUploader
                multiple
                storagePath={`clients/${clientId}/projects/draft-brief/brief`}
                acceptedTypes={[
                  'image/png',
                  'image/jpeg',
                  'application/pdf',
                  'video/mp4',
                  '.ai',
                  '.psd',
                ]}
                onChange={(items) => updateField('referenceFiles', items)}
                initialFiles={form.referenceFiles}
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3 rounded border border-border p-4 text-sm">
              <p>
                <span className="font-semibold">Title:</span> {form.title}
              </p>
              <p>
                <span className="font-semibold">Deliverable:</span> {form.deliverableType}
              </p>
              <p>
                <span className="font-semibold">Complexity:</span> {form.complexity}
              </p>
              <p>
                <span className="font-semibold">Estimated credits:</span> {estimatedCredits}
              </p>
              <p>
                <span className="font-semibold">Deadline:</span> {form.deadline || 'Not set'}
              </p>
              <p>
                <span className="font-semibold">Credits available:</span> {availableCredits}
              </p>
              <p>
                <span className="font-semibold">Reference files:</span> {Array.isArray(form.referenceFiles) ? form.referenceFiles.length : 0}
              </p>
              <p className="rounded bg-muted p-2">
                Confirming this request will set project status to
                <span className="font-semibold"> pending confirmation</span>. An admin will confirm scope and assign a creative.
              </p>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex items-center justify-between">
          <button className="rounded border border-border px-3 py-2 text-sm" onClick={prevStep} disabled={step === 1 || submitting}>
            Back
          </button>

          {step < 4 ? (
            <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={nextStep} disabled={submitting}>
              Continue
            </button>
          ) : (
            <button
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
              onClick={confirmRequest}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default NewProjectModal
