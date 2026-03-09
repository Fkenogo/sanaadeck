import { useMemo, useState } from 'react'
import { formatDateISO, normalizeTimestamp } from '@/utils/timestamp'

function withinRange(value, from, to) {
  const d = normalizeTimestamp(value)
  if (!d) return false
  if (from && d < new Date(from)) return false
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    if (d > end) return false
  }
  return true
}

function makeCsv(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (value) => {
    const str = String(value ?? '')
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
  }
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row[header])).join(','))].join('\n')
}

function ReportGenerator({ clients = [], creatives = [], projects = [], creditTransactions = [] }) {
  const [reportType, setReportType] = useState('client_revenue')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [csvOutput, setCsvOutput] = useState('')

  const generatedRows = useMemo(() => {
    if (reportType === 'client_revenue') {
      return clients.map((client) => ({
        businessName: client.businessName || client.id,
        tier: client.subscription?.tier || 'starter',
        status: client.subscription?.status || 'unknown',
        creditsUsed: Number(client.subscription?.creditsUsed || 0),
        creditsRemaining: Number(client.subscription?.creditsRemaining || 0),
      }))
    }

    if (reportType === 'creative_payout') {
      return creatives.map((creative) => ({
        name: creative.displayName || creative.id,
        tier: creative.tier || 'mid',
        payoutRate: Number(creative.payoutRate || 0),
        pendingPayout: Number(creative.earnings?.pendingPayout || 0),
        lifetimeEarnings: Number(creative.earnings?.lifetime || 0),
      }))
    }

    if (reportType === 'credit_usage') {
      return creditTransactions
        .filter((entry) => withinRange(entry.createdAt, fromDate, toDate))
        .map((entry) => ({
          date: formatDateISO(entry.createdAt),
          clientId: entry.clientId || '',
          projectId: entry.projectId || '',
          type: entry.type || '',
          source: entry.source || '',
          creditsAmount: Number(entry.creditsAmount || 0),
          description: entry.description || '',
        }))
    }

    return projects
      .filter((project) => withinRange(project.updatedAt || project.createdAt, fromDate, toDate))
      .map((project) => ({
        title: project.title,
        status: project.status,
        deliverableType: project.deliverableType,
        confirmedCredits: Number(project.confirmedCredits || 0),
        actualCreditsUsed: Number(project.actualCreditsUsed || 0),
        createdAt: formatDateISO(project.createdAt),
        updatedAt: formatDateISO(project.updatedAt),
      }))
  }, [clients, creatives, projects, creditTransactions, reportType, fromDate, toDate])

  function handleGenerate() {
    setCsvOutput(makeCsv(generatedRows))
  }

  function handleDownload() {
    if (!csvOutput) return
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${reportType}-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded border border-border p-4">
      <h2 className="text-base font-semibold">Report Generator</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="rounded border border-border px-3 py-2 text-sm">
          <option value="client_revenue">Client revenue report</option>
          <option value="creative_payout">Creative payout report</option>
          <option value="credit_usage">Credit usage report</option>
          <option value="project_completion">Project completion report</option>
        </select>

        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded border border-border px-3 py-2 text-sm" />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded border border-border px-3 py-2 text-sm" />

        <div className="flex gap-2">
          <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleGenerate}>Generate CSV</button>
          <button className="rounded border border-border px-3 py-2 text-sm" onClick={handleDownload} disabled={!csvOutput}>Download</button>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">Rows: {generatedRows.length}</p>
    </section>
  )
}

export default ReportGenerator
