import ExpenseCategory from '../models/ExpenseCategory.js'

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

export async function listExpenseCategories(req, res, next) {
  try {
    const filter = {}
    if (req.query.active === 'true') filter.isActive = true
    const cats = await ExpenseCategory.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
    res.json({ success: true, data: cats })
  } catch (err) { next(err) }
}

export async function createExpenseCategory(req, res, next) {
  try {
    const { name, sortOrder, description } = req.body
    const slug = slugify(name)
    const existing = await ExpenseCategory.findOne({ slug })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category with this name already exists' })
    }
    const cat = await ExpenseCategory.create({
      name, slug,
      sortOrder: sortOrder ?? 0,
      description: description || '',
      isActive: true,
    })
    res.status(201).json({ success: true, data: cat })
  } catch (err) { next(err) }
}

export async function updateExpenseCategory(req, res, next) {
  try {
    const { name, sortOrder, isActive, description } = req.body
    const update = {}
    if (name !== undefined) { update.name = name; update.slug = slugify(name) }
    if (sortOrder !== undefined) update.sortOrder = sortOrder
    if (isActive !== undefined) update.isActive = isActive
    if (description !== undefined) update.description = description

    const cat = await ExpenseCategory.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' })
    res.json({ success: true, data: cat })
  } catch (err) { next(err) }
}

export async function deleteExpenseCategory(req, res, next) {
  try {
    const Expense = (await import('../models/Expense.js')).default
    const count = await Expense.countDocuments({ category: req.params.id, archivedAt: null })
    if (count > 0) {
      const cat = await ExpenseCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found' })
      return res.json({ success: true, message: `Category archived — ${count} active expenses exist.`, data: cat })
    }
    await ExpenseCategory.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Category deleted' })
  } catch (err) { next(err) }
}
