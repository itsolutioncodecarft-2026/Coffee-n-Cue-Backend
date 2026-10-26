// IST offset: UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toISTMidnight(date) {
  const utc = new Date(date)
  const istDate = new Date(utc.getTime() + IST_OFFSET_MS)
  istDate.setUTCHours(0, 0, 0, 0)
  return new Date(istDate.getTime() - IST_OFFSET_MS)
}

function todayIST() {
  return toISTMidnight(new Date())
}

/**
 * Returns { start, end } UTC Date objects for a reporting period.
 * @param {'today'|'month'|'custom'} period
 * @param {string|null} fromStr  ISO date string for custom range
 * @param {string|null} toStr   ISO date string for custom range (inclusive)
 */
export function getDateRange(period, fromStr, toStr) {
  if (period === 'today') {
    const start = todayIST()
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return { start, end }
  }

  if (period === 'month') {
    const now = new Date()
    const istNow = new Date(now.getTime() + IST_OFFSET_MS)
    const year = istNow.getUTCFullYear()
    const month = istNow.getUTCMonth()
    const start = new Date(new Date(Date.UTC(year, month, 1)).getTime() - IST_OFFSET_MS)
    const end = new Date(new Date(Date.UTC(year, month + 1, 1)).getTime() - IST_OFFSET_MS)
    return { start, end }
  }

  if (period === 'custom' && fromStr && toStr) {
    const start = toISTMidnight(new Date(fromStr))
    const endDay = toISTMidnight(new Date(toStr))
    const end = new Date(endDay.getTime() + 24 * 60 * 60 * 1000)
    return { start, end }
  }

  // fallback: today
  return getDateRange('today', null, null)
}
