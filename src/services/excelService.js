import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')

// ── Helpers ───────────────────────────────────────────────────────────────

function istDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19) + ' IST'
}

function headerStyle(ws, row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    }
  })
}

function subHeaderStyle(ws, row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

function totalRowStyle(row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
    cell.font = { bold: true }
  })
}

function sectionHeaderStyle(row, label) {
  const cell = row.getCell(1)
  cell.value = label
  cell.font = { bold: true, color: { argb: 'FF1B5E20' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } }
}

const NUM_FMT = '#,##0.00'

function numCell(row, colKey, value) {
  const idx = row.worksheet.columns.findIndex((c) => c.key === colKey) + 1
  if (idx > 0 && value !== '' && value != null) {
    row.getCell(idx).numFmt = NUM_FMT
  }
}

// ── Sheet builders ────────────────────────────────────────────────────────

/**
 * Sheet: Daily Summary (metrics table)
 */
function addSummarySheet(wb, summary, periodLabel) {
  const ws = wb.addWorksheet('Daily Summary')
  ws.columns = [
    { header: 'Metric', key: 'metric', width: 40 },
    { header: 'Value', key: 'value', width: 22 },
    { header: 'Notes', key: 'notes', width: 45 },
  ]
  headerStyle(ws, ws.getRow(1))
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const add = (metric, value, notes = '', bold = false) => {
    const row = ws.addRow({ metric, value, notes })
    if (typeof value === 'number') row.getCell(2).numFmt = NUM_FMT
    if (bold) row.font = { bold: true }
    return row
  }
  const sep = () => ws.addRow({})

  add('Business Period', periodLabel, '', true)
  sep()

  // Sales
  add('── SALES ──', '', '', true)
  add('Valid Orders', summary.orderCount)
  add('Order Value (Net Sales, ₹)', summary.orderValue, 'Sum of all non-cancelled orders')
  add('Cancelled Orders', summary.cancelledCount)
  sep()

  // Collections
  add('── MONEY RECEIVED ──', '', '', true)
  add('Cash Collected (₹)', summary.cashCollected, 'Based on payment ledger timestamps')
  add('UPI Collected (₹)', summary.upiCollected, 'Based on payment ledger timestamps')
  add('Total Gross Collected (₹)', summary.totalCollected)
  add('Refunds (₹)', summary.refundTotal)
  add('Net Collected (₹)', summary.netCollected, 'Gross collections minus refunds', true)
  add('Pending Customer Payments (₹)', summary.outstandingBalance, 'Outstanding across active orders')
  add('Orders with Pending Payments', summary.pendingPaymentCount)
  sep()

  // Expenses
  add('── EXPENSES INCURRED (by expense date) ──', '', '', true)
  add('Total Expenses Incurred (₹)', summary.totalExpensesIncurred, 'Recorded operating expenses for this period')
  add('Expenses Already Paid (₹)', summary.totalExpensesPaidFromIncurred)
  add('Unpaid Supplier Expenses (₹)', summary.totalExpensesUnpaid, 'Outstanding payables to suppliers/vendors')
  sep()

  add('── EXPENSE CASH OUTFLOW (by payment date) ──', '', '', true)
  add('Cash Expense Payments (₹)', summary.expenseCashOutflow)
  add('UPI Expense Payments (₹)', summary.expenseUpiOutflow)
  add('Bank Transfer Payments (₹)', summary.expenseBankOutflow)
  add('Other Expense Payments (₹)', summary.expenseOtherOutflow)
  add('Total Expense Outflow (₹)', summary.totalExpenseOutflow, 'Actual money paid out for expenses', true)
  sep()

  // P&L
  add('── FINANCIAL ESTIMATES ──', '', '', true)
  if (summary.hasCostData) {
    add('Estimated Gross Profit (₹)', summary.estimatedGrossProfit,
      `Net Sales minus COGS. Cost data covers ${summary.costCoveragePercent}% of items.`)
  } else {
    add('Estimated Gross Profit (₹)', 'N/A — cost prices not set', 'Add cost prices to menu items for gross profit estimates')
  }
  add('Estimated Operating Result (₹)', summary.estimatedOperatingResult,
    'Net Sales minus Recorded Expenses. NOT guaranteed accounting profit.', true)
  add('Net Recorded Cash Movement (₹)', summary.netCashMovement,
    'Net Collections minus Expense Cash Outflow. Timing may differ from operating result.')
  sep()

  add('Report Generated', new Date().toISOString(), 'Asia/Kolkata timezone used for all dates')

  return ws
}

/**
 * Sheet: Order Items (one row per item)
 */
function addOrderItemsSheet(wb, orders) {
  const ws = wb.addWorksheet('Order Items')
  ws.columns = [
    { header: 'Order #', key: 'orderNumber', width: 22 },
    { header: 'Order Date (IST)', key: 'orderDate', width: 22 },
    { header: 'Customer / Table', key: 'customer', width: 20 },
    { header: 'Order Type', key: 'orderType', width: 12 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Qty', key: 'qty', width: 6 },
    { header: 'Unit Price (₹)', key: 'unitPrice', width: 14 },
    { header: 'Unit Cost (₹)', key: 'unitCost', width: 14 },
    { header: 'Line Total (₹)', key: 'lineTotal', width: 14 },
    { header: 'Order Total (₹)', key: 'orderTotal', width: 15 },
    { header: 'Paid (₹)', key: 'paid', width: 12 },
    { header: 'Outstanding (₹)', key: 'outstanding', width: 15 },
    { header: 'Order Status', key: 'orderStatus', width: 14 },
    { header: 'Payment Status', key: 'paymentStatus', width: 15 },
    { header: 'Payment Method(s)', key: 'paymentMethods', width: 18 },
    { header: 'Notes', key: 'notes', width: 24 },
  ]
  const hRow = ws.getRow(1)
  hRow.height = 36
  headerStyle(ws, hRow)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: 'Q1' }

  for (const order of orders) {
    const nonRefund = (order.payments || []).filter((p) => !p.isRefund)
    const methods = [...new Set(nonRefund.map((p) => p.method.toUpperCase()))].join('+')
    const items = order.items || []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const row = ws.addRow({
        orderNumber: order.orderNumber,
        orderDate: istDate(order.createdAt),
        customer: order.customerName || order.tableNumber || '-',
        orderType: order.orderType,
        category: item.categoryName || '',
        item: item.name,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost ?? '',
        lineTotal: item.lineTotal,
        orderTotal: i === 0 ? order.total : '',
        paid: i === 0 ? order.totalPaid : '',
        outstanding: i === 0 ? order.outstandingAmount : '',
        orderStatus: i === 0 ? order.orderStatus : '',
        paymentStatus: i === 0 ? order.paymentStatus : '',
        paymentMethods: i === 0 ? methods : '',
        notes: i === 0 ? order.notes : '',
      })
      ;['unitPrice', 'unitCost', 'lineTotal', 'orderTotal', 'paid', 'outstanding'].forEach((k) => {
        const col = ws.columns.findIndex((c) => c.key === k) + 1
        if (col > 0 && row.getCell(col).value !== '' && row.getCell(col).value != null) {
          row.getCell(col).numFmt = NUM_FMT
        }
      })
    }
  }
  return ws
}

/**
 * Sheet: Payment Transactions
 */
function addPaymentsSheet(wb, orders) {
  const ws = wb.addWorksheet('Payment Transactions')
  ws.columns = [
    { header: 'Order #', key: 'orderNumber', width: 22 },
    { header: 'Payment Date (IST)', key: 'paidAt', width: 22 },
    { header: 'Method', key: 'method', width: 10 },
    { header: 'Amount (₹)', key: 'amount', width: 14 },
    { header: 'Transaction Ref', key: 'transactionRef', width: 24 },
    { header: 'Is Refund', key: 'isRefund', width: 10 },
    { header: 'Notes', key: 'notes', width: 30 },
  ]
  const hRow = ws.getRow(1)
  hRow.height = 36
  headerStyle(ws, hRow)
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  for (const order of orders) {
    for (const p of order.payments || []) {
      const row = ws.addRow({
        orderNumber: order.orderNumber,
        paidAt: istDate(p.paidAt),
        method: p.method?.toUpperCase() || '',
        amount: p.amount,
        transactionRef: p.transactionRef || '',
        isRefund: p.isRefund ? 'Yes' : 'No',
        notes: p.notes || '',
      })
      row.getCell(4).numFmt = NUM_FMT
    }
  }
  return ws
}

/**
 * Sheet: Expense Details
 */
function addExpensesSheet(wb, expenses) {
  const ws = wb.addWorksheet('Expense Details')
  ws.columns = [
    { header: 'Title', key: 'title', width: 28 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Expense Date (IST)', key: 'expenseDate', width: 20 },
    { header: 'Payment Date (IST)', key: 'paymentDate', width: 20 },
    { header: 'Amount Incurred (₹)', key: 'amount', width: 18 },
    { header: 'Amount Paid (₹)', key: 'amountPaid', width: 16 },
    { header: 'Payment Status', key: 'paymentStatus', width: 15 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'Vendor', key: 'vendor', width: 20 },
    { header: 'Receipt #', key: 'receiptNumber', width: 16 },
    { header: 'Description', key: 'description', width: 30 },
  ]
  const hRow = ws.getRow(1)
  hRow.height = 36
  headerStyle(ws, hRow)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: 'K1' }

  for (const e of expenses) {
    const row = ws.addRow({
      title: e.title,
      category: e.categoryName || e.category?.name || '',
      expenseDate: istDate(e.expenseDate),
      paymentDate: e.paymentDate ? istDate(e.paymentDate) : '-',
      amount: e.amount,
      amountPaid: e.amountPaid,
      paymentStatus: e.paymentStatus,
      paymentMethod: (e.paymentMethod || '').replace('_', ' ').toUpperCase(),
      vendor: e.vendor || '',
      receiptNumber: e.receiptNumber || '',
      description: e.description || '',
    })
    row.getCell(5).numFmt = NUM_FMT
    row.getCell(6).numFmt = NUM_FMT
    if (e.paymentStatus === 'unpaid') {
      row.font = { color: { argb: 'FFC62828' } }
    }
  }

  // Totals row
  const totRow = ws.addRow({
    title: 'TOTAL',
    amount: expenses.reduce((s, e) => s + e.amount, 0),
    amountPaid: expenses.reduce((s, e) => s + e.amountPaid, 0),
  })
  totRow.font = { bold: true }
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
  totRow.getCell(5).numFmt = NUM_FMT
  totRow.getCell(6).numFmt = NUM_FMT

  return ws
}

/**
 * Sheet: Daily Breakdown (orders + collections + expenses per day)
 */
function addDailyBreakdownSheet(wb, daily) {
  const ws = wb.addWorksheet('Daily Breakdown')
  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Orders', key: 'orderCount', width: 8 },
    { header: 'Net Sales (₹)', key: 'orderValue', width: 16 },
    { header: 'Cash Collected (₹)', key: 'cashCollected', width: 18 },
    { header: 'UPI Collected (₹)', key: 'upiCollected', width: 16 },
    { header: 'Total Collected (₹)', key: 'totalCollected', width: 18 },
    { header: 'Outstanding (₹)', key: 'outstanding', width: 16 },
    { header: 'Expenses Incurred (₹)', key: 'expensesIncurred', width: 20 },
    { header: 'Expense Outflow (₹)', key: 'expenseOutflow', width: 18 },
    { header: 'Est. Operating Result (₹)', key: 'estimatedOperatingResult', width: 24 },
  ]
  const hRow = ws.getRow(1)
  hRow.height = 36
  headerStyle(ws, hRow)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: 'J1' }

  const numCols = ['orderValue', 'cashCollected', 'upiCollected', 'totalCollected',
    'outstanding', 'expensesIncurred', 'expenseOutflow', 'estimatedOperatingResult']

  for (const day of daily) {
    const row = ws.addRow(day)
    numCols.forEach((k) => {
      const col = ws.columns.findIndex((c) => c.key === k) + 1
      if (col > 0) row.getCell(col).numFmt = NUM_FMT
      // Color negative operating result red
      if (k === 'estimatedOperatingResult' && day.estimatedOperatingResult < 0) {
        row.getCell(col).font = { color: { argb: 'FFC62828' } }
      }
    })
  }

  const totRow = ws.addRow({
    date: 'TOTAL',
    orderCount: daily.reduce((s, d) => s + d.orderCount, 0),
    orderValue: daily.reduce((s, d) => s + d.orderValue, 0),
    cashCollected: daily.reduce((s, d) => s + d.cashCollected, 0),
    upiCollected: daily.reduce((s, d) => s + d.upiCollected, 0),
    totalCollected: daily.reduce((s, d) => s + d.totalCollected, 0),
    outstanding: daily.reduce((s, d) => s + d.outstanding, 0),
    expensesIncurred: daily.reduce((s, d) => s + d.expensesIncurred, 0),
    expenseOutflow: daily.reduce((s, d) => s + d.expenseOutflow, 0),
    estimatedOperatingResult: daily.reduce((s, d) => s + d.estimatedOperatingResult, 0),
  })
  totalRowStyle(totRow)
  numCols.forEach((k) => {
    const col = ws.columns.findIndex((c) => c.key === k) + 1
    if (col > 0) totRow.getCell(col).numFmt = NUM_FMT
  })

  return ws
}

/**
 * Sheet: Expense Category Totals
 */
function addCategoryTotalsSheet(wb, expenses) {
  const catMap = {}
  for (const e of expenses) {
    const key = e.categoryName || 'Uncategorised'
    if (!catMap[key]) catMap[key] = { name: key, incurred: 0, paid: 0, count: 0 }
    catMap[key].incurred += e.amount
    catMap[key].paid += e.amountPaid
    catMap[key].count += 1
  }
  const cats = Object.values(catMap).sort((a, b) => b.incurred - a.incurred)

  const ws = wb.addWorksheet('Expense by Category')
  ws.columns = [
    { header: 'Category', key: 'name', width: 28 },
    { header: 'Count', key: 'count', width: 8 },
    { header: 'Total Incurred (₹)', key: 'incurred', width: 20 },
    { header: 'Total Paid (₹)', key: 'paid', width: 18 },
    { header: 'Outstanding (₹)', key: 'outstanding', width: 18 },
  ]
  headerStyle(ws, ws.getRow(1))

  for (const cat of cats) {
    const row = ws.addRow({ ...cat, outstanding: cat.incurred - cat.paid })
    ;[3, 4, 5].forEach((col) => { row.getCell(col).numFmt = NUM_FMT })
  }

  const totRow = ws.addRow({
    name: 'TOTAL',
    count: cats.reduce((s, c) => s + c.count, 0),
    incurred: cats.reduce((s, c) => s + c.incurred, 0),
    paid: cats.reduce((s, c) => s + c.paid, 0),
    outstanding: cats.reduce((s, c) => s + (c.incurred - c.paid), 0),
  })
  totalRowStyle(totRow)
  ;[3, 4, 5].forEach((col) => { totRow.getCell(col).numFmt = NUM_FMT })

  return ws
}

// ── Public export functions ───────────────────────────────────────────────

/**
 * Daily Report: Summary + Orders + Payments + Expenses
 */
export async function buildDailyReport(summary, orders, expenses, dateLabel) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Coffee N Cue'
  wb.created = new Date()

  addSummarySheet(wb, summary, dateLabel)
  addOrderItemsSheet(wb, orders)
  addPaymentsSheet(wb, orders)
  addExpensesSheet(wb, expenses)

  return wb
}

/**
 * Order Export (backward-compatible)
 */
export async function buildOrderExport(orders, fromLabel, toLabel) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Coffee N Cue'
  wb.created = new Date()

  addOrderItemsSheet(wb, orders)
  addPaymentsSheet(wb, orders)

  // Summary sheet (order-level only, no expenses)
  const ws3 = wb.addWorksheet('Summary')
  ws3.columns = [{ header: 'Metric', key: 'metric', width: 34 }, { header: 'Value', key: 'value', width: 20 }]
  headerStyle(ws3, ws3.getRow(1))

  const nonCancelled = orders.filter((o) => o.orderStatus !== 'cancelled')
  const totalValue = nonCancelled.reduce((s, o) => s + o.total, 0)
  const allPayments = orders.flatMap((o) => (o.payments || []).filter((p) => !p.isRefund))
  const cashTotal = allPayments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
  const upiTotal = allPayments.filter((p) => p.method === 'upi').reduce((s, p) => s + p.amount, 0)
  const refundTotal = orders.flatMap((o) => (o.payments || []).filter((p) => p.isRefund)).reduce((s, p) => s + p.amount, 0)

  const rows = [
    ['Report Period', `${fromLabel} to ${toLabel}`],
    ['Total Valid Orders', nonCancelled.length],
    ['Total Order Value (₹)', totalValue],
    ['Cash Collected (₹)', cashTotal],
    ['UPI Collected (₹)', upiTotal],
    ['Total Collected (₹)', cashTotal + upiTotal],
    ['Refunds (₹)', refundTotal],
    ['Net Collected (₹)', cashTotal + upiTotal - refundTotal],
    ['Cancelled Orders', orders.filter((o) => o.orderStatus === 'cancelled').length],
  ]
  for (const [metric, value] of rows) {
    const row = ws3.addRow({ metric, value })
    if (typeof value === 'number') row.getCell(2).numFmt = NUM_FMT
  }

  return wb
}

/**
 * Monthly Report: Summary + Daily Breakdown + Orders + Payments + Expenses + Category Totals
 */
export async function buildMonthlyExport(summary, daily, expenses, fromLabel, toLabel) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Coffee N Cue'
  wb.created = new Date()

  addSummarySheet(wb, summary, `${fromLabel} to ${toLabel}`)
  addDailyBreakdownSheet(wb, daily)
  addExpensesSheet(wb, expenses)
  addCategoryTotalsSheet(wb, expenses)

  return wb
}

/**
 * Custom range report: all sheets
 */
export async function buildCustomExport(summary, daily, orders, expenses, fromLabel, toLabel) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Coffee N Cue'
  wb.created = new Date()

  addSummarySheet(wb, summary, `${fromLabel} to ${toLabel}`)
  addDailyBreakdownSheet(wb, daily)
  addOrderItemsSheet(wb, orders)
  addPaymentsSheet(wb, orders)
  addExpensesSheet(wb, expenses)
  addCategoryTotalsSheet(wb, expenses)

  return wb
}
