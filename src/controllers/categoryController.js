import Category from '../models/Category.js'

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

export async function listCategories(req, res, next) {
  try {
    const filter = {}
    if (req.query.active === 'true') filter.isActive = true
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
    res.json({ success: true, data: categories })
  } catch (err) { next(err) }
}

export async function createCategory(req, res, next) {
  try {
    const { name, sortOrder, isActive } = req.body
    const slug = slugify(name)

    const existing = await Category.findOne({ slug })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category with this name already exists' })
    }

    const category = await Category.create({
      name,
      slug,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    })

    res.status(201).json({ success: true, data: category })
  } catch (err) { next(err) }
}

export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params
    const { name, sortOrder, isActive } = req.body

    const update = {}
    if (name !== undefined) {
      update.name = name
      update.slug = slugify(name)
    }
    if (sortOrder !== undefined) update.sortOrder = sortOrder
    if (isActive !== undefined) update.isActive = isActive

    const category = await Category.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' })

    res.json({ success: true, data: category })
  } catch (err) { next(err) }
}

export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params
    // Check if any menu items reference this category
    const MenuItem = (await import('../models/MenuItem.js')).default
    const count = await MenuItem.countDocuments({ category: id })
    if (count > 0) {
      // Archive instead of delete
      const category = await Category.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      )
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' })
      return res.json({ success: true, message: `Category archived (${count} items exist). It was not deleted.`, data: category })
    }

    await Category.findByIdAndDelete(id)
    res.json({ success: true, message: 'Category deleted' })
  } catch (err) { next(err) }
}
