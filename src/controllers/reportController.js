import { getDateRange } from '../utils/dateRange.js'
import {
  getSummary, getDailyBreakdown,
  getOrdersForReport, getExpensesForReport,
  getExpenseCategoryBreakdown,
} from '../services/reportingService.js'
import {
  buildDailyReport, buildOrderExport,
  buildMonthlyExport, buildCustomExport,
} from '../services/excelService.js'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function singleDayRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  const start = new Date(d.getTime() - IST_OFFSET_MS)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

function parsePeriod(query) {
  const { period, from, to, date, startDate, endDate } = query
  if (date) return singleDayRange(date)
  if (startDate && endDate) return getDateRange('custom', startDate, endDate)
  if (period === 'month') return getDateRange('month', null, null)
  if (period === 'custom' && from && to) return getDateRange('custom', from, to)
  return getDateRange('today', null, null)
}

function labelFromRange(start, end) {
  const opts = { timeZone: 'Asia/Kolkata' }
  const fromLabel = start.toLocaleDateString('en-IN', opts)
  const toLabel = new Date(end.getTime() - 1).toLocaleDateString('en-IN', opts)
  return { fromLabel, toLabel }
}

export async function reportSummary(req, res, next) {
  try {
    const { start, end } = parsePeriod(req.query)
    const [summary, daily, catBreakdown] = await Promise.all([
      getSummary(start, end),
      getDailyBreakdown(start, end),
      getExpenseCategoryBreakdown(start, end),
    ])
    res.json({
      success: true,
      data: { summary, daily, expenseCategoryBreakdown: catBreakdown },
      period: { from: start, to: end },
    })
  } catch (err) { next(err) }
}

export async function exportOrders(req, res, next) {
  try {
    const { start, end } = parsePeriod(req.query)
    const { fromLabel, toLabel } = labelFromRange(start, end)
    const orders = await getOrdersForReport(start, end)
    const wb = await buildOrderExport(orders, fromLabel, toLabel)

    const dateStr = start.toISOString().slice(0, 10)
    const filename = `Coffee_N_Cue_Orders_${dateStr}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err) { next(err) }
}

export async function exportMonthlySummary(req, res, next) {
  try {
    const { start, end } = parsePeriod(req.query)
    const { fromLabel, toLabel } = labelFromRange(start, end)
    const [summary, daily, expenses] = await Promise.all([
      getSummary(start, end),
      getDailyBreakdown(start, end),
      getExpensesForReport(start, end),
    ])
    const wb = await buildMonthlyExport(summary, daily, expenses, fromLabel, toLabel)

    const period = req.query.period === 'month'
      ? start.toISOString().slice(0, 7)
      : start.toISOString().slice(0, 10)
    const filename = `Coffee_N_Cue_Report_${period}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err) { next(err) }
}

export async function exportDaily(req, res, next) {
  try {
    const date = req.query.date
    if (!date) return res.status(400).json({ success: false, message: 'date param (YYYY-MM-DD) required' })
    const { start, end } = singleDayRange(date)
    const { fromLabel } = labelFromRange(start, end)
    const [summary, orders, expenses] = await Promise.all([
      getSummary(start, end),
      getOrdersForReport(start, end),
      getExpensesForReport(start, end),
    ])
    const wb = await buildDailyReport(summary, orders, expenses, fromLabel)
    const filename = `Coffee_N_Cue_Daily_Report_${date}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err) { next(err) }
}

export async function exportCustom(req, res, next) {
  try {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'startDate and endDate required' })
    const { start, end } = getDateRange('custom', startDate, endDate)
    const { fromLabel, toLabel } = labelFromRange(start, end)
    const [summary, daily, orders, expenses] = await Promise.all([
      getSummary(start, end),
      getDailyBreakdown(start, end),
      getOrdersForReport(start, end),
      getExpensesForReport(start, end),
    ])
    const wb = await buildCustomExport(summary, daily, orders, expenses, fromLabel, toLabel)
    const filename = `Coffee_N_Cue_Custom_Report_${startDate}_to_${endDate}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err) { next(err) }
}
