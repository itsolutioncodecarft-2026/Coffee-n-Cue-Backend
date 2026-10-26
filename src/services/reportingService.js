import Order from '../models/Order.js'
import Payment from '../models/Payment.js'
import Expense from '../models/Expense.js'

/**
 * Core financial summary for a date range.
 *
 * Sales figures use order createdAt (business date).
 * Collection figures use payment paidAt (actual payment timestamp).
 * Expense incurred figures use expense expenseDate (when the cost was incurred).
 * Expense cash-outflow figures use expense paymentDate (when money actually left).
 *
 * All inputs must be UTC Date objects aligned to IST midnight.
 */
export async function getSummary(start, end) {
  const [
    orderAgg,
    cancelledCount,
    pendingCount,
    paymentAgg,
    refundAgg,
    expenseAgg,
    expensePaidAgg,
  ] = await Promise.all([
    // Valid (non-cancelled) orders in range
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalValue: { $sum: '$total' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          // Sum of known cost fields for COGS estimate
          knownCost: {
            $sum: {
              $reduce: {
                input: '$items',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $cond: [
                        { $gt: ['$$this.unitCost', null] },
                        { $multiply: ['$$this.unitCost', '$$this.quantity'] },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
          itemsWithCost: {
            $sum: {
              $size: {
                $filter: {
                  input: '$items',
                  as: 'item',
                  cond: { $gt: ['$$item.unitCost', null] },
                },
              },
            },
          },
          totalItems: { $sum: { $size: '$items' } },
        },
      },
    ]),

    // Cancelled orders count
    Order.countDocuments({ createdAt: { $gte: start, $lt: end }, orderStatus: 'cancelled' }),

    // Pending payment count
    Order.countDocuments({
      createdAt: { $gte: start, $lt: end },
      paymentStatus: { $in: ['pending', 'partial'] },
      orderStatus: { $ne: 'cancelled' },
    }),

    // Collections from payment ledger (by paidAt)
    Payment.aggregate([
      { $match: { paidAt: { $gte: start, $lt: end }, isRefund: false } },
      { $group: { _id: '$method', total: { $sum: '$amount' } } },
    ]),

    // Refunds (by paidAt)
    Payment.aggregate([
      { $match: { paidAt: { $gte: start, $lt: end }, isRefund: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Expenses incurred (by expenseDate) — non-archived
    Expense.aggregate([
      { $match: { expenseDate: { $gte: start, $lt: end }, archivedAt: null } },
      {
        $group: {
          _id: '$paymentMethod',
          totalIncurred: { $sum: '$amount' },
          totalPaid: { $sum: '$amountPaid' },
        },
      },
    ]),

    // Expenses actually paid in this period (by paymentDate) — non-archived
    Expense.aggregate([
      {
        $match: {
          paymentDate: { $gte: start, $lt: end },
          paymentStatus: 'paid',
          archivedAt: null,
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amountPaid' },
        },
      },
    ]),
  ])

  // ── Sales ─────────────────────────────────────────────────────────────
  const orderStats = orderAgg[0] || {
    count: 0, totalValue: 0, totalOutstanding: 0,
    knownCost: 0, itemsWithCost: 0, totalItems: 0,
  }
  const hasCostData = orderStats.itemsWithCost > 0
  const costCoveragePercent = orderStats.totalItems > 0
    ? Math.round((orderStats.itemsWithCost / orderStats.totalItems) * 100)
    : 0

  // ── Collections ───────────────────────────────────────────────────────
  const cashCollected = paymentAgg.find((p) => p._id === 'cash')?.total || 0
  const upiCollected = paymentAgg.find((p) => p._id === 'upi')?.total || 0
  const refundTotal = refundAgg[0]?.total || 0
  const totalCollected = cashCollected + upiCollected
  const netCollected = totalCollected - refundTotal

  // ── Expenses (incurred — by expenseDate) ──────────────────────────────
  let totalExpensesIncurred = 0
  let expensesPaidCash = 0
  let expensesPaidUpi = 0
  let expensesPaidBank = 0
  let expensesPaidOther = 0
  let totalExpensesPaidFromIncurred = 0

  for (const e of expenseAgg) {
    totalExpensesIncurred += e.totalIncurred
    totalExpensesPaidFromIncurred += e.totalPaid
  }
  const totalExpensesUnpaid = totalExpensesIncurred - totalExpensesPaidFromIncurred

  // ── Expense cash outflow (by paymentDate) ────────────────────────────
  let expenseCashOutflow = 0
  let expenseUpiOutflow = 0
  let expenseBankOutflow = 0
  let expenseOtherOutflow = 0

  for (const e of expensePaidAgg) {
    if (e._id === 'cash') expenseCashOutflow = e.total
    else if (e._id === 'upi') expenseUpiOutflow = e.total
    else if (e._id === 'bank_transfer') expenseBankOutflow = e.total
    else expenseOtherOutflow += e.total
  }
  const totalExpenseOutflow = expenseCashOutflow + expenseUpiOutflow + expenseBankOutflow + expenseOtherOutflow

  // ── P&L estimates ─────────────────────────────────────────────────────
  const estimatedGrossProfit = hasCostData
    ? orderStats.totalValue - orderStats.knownCost
    : null
  const estimatedOperatingResult = orderStats.totalValue - totalExpensesIncurred
  const netCashMovement = netCollected - totalExpenseOutflow

  return {
    // Sales (order business date)
    orderCount: orderStats.count,
    orderValue: orderStats.totalValue,
    cancelledCount,

    // Collections (payment paidAt)
    cashCollected,
    upiCollected,
    totalCollected,
    refundTotal,
    netCollected,

    // Pending
    outstandingBalance: orderStats.totalOutstanding,
    pendingPaymentCount: pendingCount,

    // Expenses incurred (expenseDate)
    totalExpensesIncurred,
    totalExpensesPaidFromIncurred,
    totalExpensesUnpaid,

    // Expense cash outflow (paymentDate)
    totalExpenseOutflow,
    expenseCashOutflow,
    expenseUpiOutflow,
    expenseBankOutflow,
    expenseOtherOutflow,

    // P&L (clearly labelled as estimates)
    estimatedGrossProfit,     // null when cost data incomplete
    costCoveragePercent,      // % of items with cost prices
    hasCostData,
    estimatedOperatingResult, // net sales - recorded expenses (NOT guaranteed profit)
    netCashMovement,          // net collections - expense outflow
  }
}

/**
 * Per-day breakdown including expenses.
 */
export async function getDailyBreakdown(start, end) {
  const [orderDays, paymentDays, expenseDays, expensePaidDays] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          orderCount: { $sum: 1 },
          orderValue: { $sum: '$total' },
          outstanding: { $sum: '$outstandingAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Payment.aggregate([
      { $match: { paidAt: { $gte: start, $lt: end }, isRefund: false } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Kolkata' } },
            method: '$method',
          },
          total: { $sum: '$amount' },
        },
      },
    ]),

    // Expenses incurred by expenseDate
    Expense.aggregate([
      { $match: { expenseDate: { $gte: start, $lt: end }, archivedAt: null } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate', timezone: 'Asia/Kolkata' } },
          totalIncurred: { $sum: '$amount' },
          totalPaid: { $sum: '$amountPaid' },
        },
      },
    ]),

    // Expense outflow by paymentDate
    Expense.aggregate([
      { $match: { paymentDate: { $gte: start, $lt: end }, paymentStatus: 'paid', archivedAt: null } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate', timezone: 'Asia/Kolkata' } },
          totalOutflow: { $sum: '$amountPaid' },
        },
      },
    ]),
  ])

  const dayMap = {}

  const ensureDay = (d) => {
    if (!dayMap[d]) {
      dayMap[d] = {
        date: d,
        orderCount: 0, orderValue: 0,
        cashCollected: 0, upiCollected: 0, totalCollected: 0,
        outstanding: 0,
        expensesIncurred: 0, expensesPaid: 0,
        expenseOutflow: 0,
        estimatedOperatingResult: 0,
      }
    }
  }

  for (const od of orderDays) {
    ensureDay(od._id)
    dayMap[od._id].orderCount = od.orderCount
    dayMap[od._id].orderValue = od.orderValue
    dayMap[od._id].outstanding = od.outstanding
  }
  for (const pd of paymentDays) {
    const day = pd._id.day
    ensureDay(day)
    if (pd._id.method === 'cash') dayMap[day].cashCollected += pd.total
    if (pd._id.method === 'upi') dayMap[day].upiCollected += pd.total
    dayMap[day].totalCollected = dayMap[day].cashCollected + dayMap[day].upiCollected
  }
  for (const ed of expenseDays) {
    ensureDay(ed._id)
    dayMap[ed._id].expensesIncurred += ed.totalIncurred
    dayMap[ed._id].expensesPaid += ed.totalPaid
  }
  for (const ep of expensePaidDays) {
    ensureDay(ep._id)
    dayMap[ep._id].expenseOutflow += ep.totalOutflow
  }

  // Calculate estimated operating result per day
  for (const day of Object.values(dayMap)) {
    day.estimatedOperatingResult = day.orderValue - day.expensesIncurred
  }

  return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Fetch orders with embedded payments for report export.
 */
export async function getOrdersForReport(start, end) {
  const orders = await Order.find({ createdAt: { $gte: start, $lt: end } })
    .sort({ createdAt: 1 }).lean()

  const orderIds = orders.map((o) => o._id)
  const payments = await Payment.find({ order: { $in: orderIds } }).lean()

  const paymentsByOrder = {}
  for (const p of payments) {
    const oid = p.order.toString()
    if (!paymentsByOrder[oid]) paymentsByOrder[oid] = []
    paymentsByOrder[oid].push(p)
  }

  return orders.map((o) => ({ ...o, payments: paymentsByOrder[o._id.toString()] || [] }))
}

/**
 * Fetch expenses for report export.
 * expenseDate filter for incurred; paymentDate for outflow.
 */
export async function getExpensesForReport(start, end) {
  return Expense.find({ expenseDate: { $gte: start, $lt: end }, archivedAt: null })
    .populate('category', 'name')
    .sort({ expenseDate: 1 })
    .lean()
}

/**
 * Expense category breakdown for a period.
 */
export async function getExpenseCategoryBreakdown(start, end) {
  return Expense.aggregate([
    { $match: { expenseDate: { $gte: start, $lt: end }, archivedAt: null } },
    {
      $group: {
        _id: '$category',
        categoryName: { $first: '$categoryName' },
        totalIncurred: { $sum: '$amount' },
        totalPaid: { $sum: '$amountPaid' },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalIncurred: -1 } },
  ])
}
