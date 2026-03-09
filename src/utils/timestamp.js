/**
 * Convert any Firestore Timestamp, Date, number (ms), or date string to milliseconds.
 * Returns 0 if the value cannot be resolved.
 */
export function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return date.getTime()
}

/**
 * Convert any timestamp-like value to a JS Date, or null if invalid.
 */
export function normalizeTimestamp(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const ms = toMillis(value)
  if (!ms) return null
  return new Date(ms)
}

/**
 * Format a date-like value as a locale date string (e.g. "3/5/2026").
 * Returns 'Unknown' if the value is null/invalid.
 */
export function formatDate(value) {
  if (!value) return 'Unknown'
  const date = normalizeTimestamp(value)
  if (!date) return 'Unknown'
  return date.toLocaleDateString()
}

/**
 * Format a date-like value as a locale date+time string (e.g. "3/5/2026, 2:30:45 PM").
 * Returns 'Unknown' if the value is null/invalid.
 */
export function formatDateTime(value) {
  if (!value) return 'Unknown'
  const date = normalizeTimestamp(value)
  if (!date) return 'Unknown'
  return date.toLocaleString()
}

/**
 * Format a date-like value as an ISO date string (e.g. "2026-03-05").
 * Returns '' if the value is null/invalid. Useful for date input fields.
 */
export function formatDateISO(value) {
  if (!value) return ''
  const date = normalizeTimestamp(value)
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

/**
 * Return a YYYY-MM label for a month offset from now.
 * 0 = current month, 1 = last month, etc.
 */
export function monthLabel(offset) {
  const date = new Date()
  date.setMonth(date.getMonth() - offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
