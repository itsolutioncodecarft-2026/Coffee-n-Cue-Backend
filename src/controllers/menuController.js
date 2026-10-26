import MenuItem from '../models/MenuItem.js'
import Category from '../models/Category.js'

export async function listMenu(req, res, next) {
  try {
    const filter = {}
    if (req.query.category) filter.category = req.query.category
    if (req.query.available === 'true') filter.isAvailable = true
    if (req.query.available === 'false') filter.isAvailable = false

    const search = req.query.search
    if (search) {
      filter.name = { $regex: search, $options: 'i' }
    }

    const items = await MenuItem.find(filter)
      .populate('category', 'name slug isActive')
      .sort({ 'category.sortOrder': 1, name: 1 })
      .lean()

    res.json({ success: true, data: items })
  } catch (err) { next(err) }
}

export async function getMenuItem(req, res, next) {
  try {
    const item = await MenuItem.findById(req.params.id).populate('category', 'name slug').lean()
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' })
    res.json({ success: true, data: item })
  } catch (err) { next(err) }
}

export async function createMenuItem(req, res, next) {
  try {
    const { name, category, price, costPrice, customPrice, isAvailable } = req.body
    const cat = await Category.findById(category)
    if (!cat) return res.status(400).json({ success: false, message: 'Category not found' })
    const item = await MenuItem.create({
      name, category, price,
      costPrice: costPrice ?? null,
      customPrice: customPrice ?? false,
      isAvailable: isAvailable ?? true,
    })
    const populated = await item.populate('category', 'name slug')
    res.status(201).json({ success: true, data: populated })
  } catch (err) { next(err) }
}

export async function updateMenuItem(req, res, next) {
  try {
    const { name, category, price, costPrice, customPrice, isAvailable } = req.body
    const update = {}
    if (name !== undefined) update.name = name
    if (price !== undefined) update.price = price
    if (costPrice !== undefined) update.costPrice = costPrice === '' ? null : costPrice
    if (customPrice !== undefined) update.customPrice = customPrice
    if (isAvailable !== undefined) update.isAvailable = isAvailable
    if (category !== undefined) {
      const cat = await Category.findById(category)
      if (!cat) return res.status(400).json({ success: false, message: 'Category not found' })
      update.category = category
    }
    const item = await MenuItem.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('category', 'name slug')
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' })
    res.json({ success: true, data: item })
  } catch (err) { next(err) }
}

export async function deleteMenuItem(req, res, next) {
  try {
    // Safe: disable instead of delete if item has been ordered
    const Order = (await import('../models/Order.js')).default
    const hasOrders = await Order.exists({ 'items.menuItemId': req.params.id })

    if (hasOrders) {
      const item = await MenuItem.findByIdAndUpdate(
        req.params.id,
        { isAvailable: false },
        { new: true }
      )
      if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' })
      return res.json({ success: true, message: 'Item has existing orders — it was disabled instead of deleted.', data: item })
    }

    await MenuItem.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Menu item deleted' })
  } catch (err) { next(err) }
}
