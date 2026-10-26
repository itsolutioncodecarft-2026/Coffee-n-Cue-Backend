import Expense from '../models/Expense.js'
import ExpenseCategory from '../models/ExpenseCategory.js'
import { getDateRange } from '../utils/dateRange.js'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Convert a YYYY-MM-DD string to the IST midnight UTC Date */
function istDateFromString(str) {
  const d = new Date(str + 'T00:00:00.000Z')
  return new Date(d.getTime() - IST_OFFSET_MS)
}

export async function listExpenses(req, res, next) {
  try {
    const {
      page = 1, limit = 25,
      search, category, from, to,
      paymentMethod, paymentStatus,
    } = req.query

    const filter = { archivedAt: null }
    if (category) filter.category = category
    if (paymentMethod) filter.paymentMethod = paymentMethod
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { vendor: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } },
      ]
    }
    if (from || to) {
      filter.expenseDate = {}
      if (from) filter.expenseDate.$gte = istDateFromString(from)
      if (to) {
        const end = istDateFromString(to)
        filter.expenseDate.$lt = new Date(end.getTime() + 24 * 60 * 60 * 1000)
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate('category', 'name slug')
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip).limit(parseInt(limit)).lean(),
      Expense.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: expenses,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
}

export async function getExpense(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('category', 'name slug')
      .lean()
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' })
    res.json({ success: true, data: expense })
  } catch (err) { next(err) }
}

export async function createExpense(req, res, next) {
  try {
    const {
      title, category, amount, expenseDate,
      paymentStatus, paymentMethod, amountPaid, paymentDate,
      vendor, receiptNumber, description,
    } = req.body

    const cat = await ExpenseCategory.findById(category)
    if (!cat) return res.status(400).json({ success: false, message: 'Expense category not found' })

    // Determine amountPaid
    const paid = paymentStatus === 'paid'
      ? (amountPaid ?? amount)
      : (amountPaid ?? 0)

    const expense = await Expense.create({
      title,
      category,
      categoryName: cat.name,
      amount,
      expenseDate: new Date(expenseDate),
      paymentStatus: paymentStatus || 'paid',
      paymentMethod: paymentMethod || 'cash',
      amountPaid: paid,
      paymentDate: paymentStatus === 'paid' ? (paymentDate ? new Date(paymentDate) : new Date()) : (paymentDate ? new Date(paymentDate) : null),
      vendor: vendor || '',
      receiptNumber: receiptNumber || '',
      description: description || '',
      createdBy: req.admin?.id || null,
    })

    const populated = await expense.populate('category', 'name slug')
    res.status(201).json({ success: true, data: populated, message: 'Expense recorded' })
  } catch (err) { next(err) }
}

export async function updateExpense(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' })
    if (expense.archivedAt) return res.status(400).json({ success: false, message: 'Cannot edit an archived expense' })

    const {
      title, category, amount, expenseDate,
      paymentStatus, paymentMethod, amountPaid, paymentDate,
      vendor, receiptNumber, description,
    } = req.body

    if (title !== undefined) expense.title = title
    if (amount !== undefined) expense.amount = amount
    if (expenseDate !== undefined) expense.expenseDate = new Date(expenseDate)
    if (paymentStatus !== undefined) expense.paymentStatus = paymentStatus
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod
    if (amountPaid !== undefined) expense.amountPaid = amountPaid
    if (paymentDate !== undefined) expense.paymentDate = paymentDate ? new Date(paymentDate) : null
    if (vendor !== undefined) expense.vendor = vendor
    if (receiptNumber !== undefined) expense.receiptNumber = receiptNumber
    if (description !== undefined) expense.description = description
    if (category !== undefined) {
      const cat = await ExpenseCategory.findById(category)
      if (!cat) return res.status(400).json({ success: false, message: 'Expense category not found' })
      expense.category = category
      expense.categoryName = cat.name
    }

    expense.updatedBy = req.admin?.id || null
    await expense.save()

    const populated = await expense.populate('category', 'name slug')
    res.json({ success: true, data: populated, message: 'Expense updated' })
  } catch (err) { next(err) }
}

export async function archiveExpense(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' })
    if (expense.archivedAt) return res.status(400).json({ success: false, message: 'Already archived' })

    expense.archivedAt = new Date()
    expense.archivedBy = req.admin?.id || null
    await expense.save()

    res.json({ success: true, message: 'Expense archived', data: expense })
  } catch (err) { next(err) }
}
