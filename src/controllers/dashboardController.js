import { getDateRange } from '../utils/dateRange.js'
import { getSummary, getDailyBreakdown } from '../services/reportingService.js'
import Order from '../models/Order.js'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function singleDayRange(dateStr) {
  // dateStr is YYYY-MM-DD in IST
  const d = new Date(dateStr + 'T00:00:00.000Z')
  const start = new Date(d.getTime() - IST_OFFSET_MS)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function dashboardSummary(req, res, next) {
  try {
    const { date, startDate, endDate, period } = req.query

    // ── Historical single-date view ──────────────────────────────────────
    if (date) {
      const { start, end } = singleDayRange(date)
      const [summary, recentOrders, pendingOrders] = await Promise.all([
        getSummary(start, end),
        Order.find({ createdAt: { $gte: start, $lt: end } })
          .sort({ createdAt: -1 }).limit(20).lean(),
        Order.find({
          createdAt: { $gte: start, $lt: end },
          paymentStatus: { $in: ['pending', 'partial'] },
          orderStatus: { $ne: 'cancelled' },
        }).sort({ createdAt: -1 }).limit(20).lean(),
      ])
      return res.json({
        success: true,
        data: { summary, recentOrders, pendingOrders },
        period: { type: 'date', date, start, end },
      })
    }

    // ── Custom date range ────────────────────────────────────────────────
    if (startDate && endDate) {
      const { start, end } = getDateRange('custom', startDate, endDate)
      const [summary, daily, recentOrders, pendingOrders] = await Promise.all([
        getSummary(start, end),
        getDailyBreakdown(start, end),
        Order.find({ createdAt: { $gte: start, $lt: end } })
          .sort({ createdAt: -1 }).limit(20).lean(),
        Order.find({
          createdAt: { $gte: start, $lt: end },
          paymentStatus: { $in: ['pending', 'partial'] },
          orderStatus: { $ne: 'cancelled' },
        }).sort({ createdAt: -1 }).limit(20).lean(),
      ])
      return res.json({
        success: true,
        data: { summary, daily, recentOrders, pendingOrders },
        period: { type: 'range', startDate, endDate, start, end },
      })
    }

    // ── Today + month summary (default home dashboard) ───────────────────
    const todayRange = getDateRange('today', null, null)
    const monthRange = getDateRange('month', null, null)

    const [todaySummary, monthSummary, recentOrders, pendingOrders] = await Promise.all([
      getSummary(todayRange.start, todayRange.end),
      getSummary(monthRange.start, monthRange.end),
      Order.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      Order.find({
        paymentStatus: { $in: ['pending', 'partial'] },
        orderStatus: { $ne: 'cancelled' },
      }).sort({ createdAt: -1 }).limit(10).lean(),
    ])

    res.json({
      success: true,
      data: { today: todaySummary, month: monthSummary, recentOrders, pendingOrders },
      period: { type: 'default' },
    })
  } catch (err) { next(err) }
}
