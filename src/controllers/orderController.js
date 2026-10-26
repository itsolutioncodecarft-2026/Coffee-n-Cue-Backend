import Order from '../models/Order.js'
import MenuItem from '../models/MenuItem.js'
import { generateOrderNumber } from '../utils/orderNumber.js'

const VALID_TRANSITIONS = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: [],
}

export async function listOrders(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      search,
      from,
      to,
    } = req.query

    const filter = {}
    if (status) filter.orderStatus = status
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (search) filter.orderNumber = { $regex: search, $options: 'i' }
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999))
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Order.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: orders,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
}

export async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id).lean()
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const Payment = (await import('../models/Payment.js')).default
    const payments = await Payment.find({ order: order._id }).sort({ paidAt: 1 }).lean()

    res.json({ success: true, data: { ...order, payments } })
  } catch (err) { next(err) }
}

export async function createOrder(req, res, next) {
  try {
    const { customerName, tableNumber, orderType, items, notes } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have at least one item' })
    }

    // Resolve items from DB — never trust client-submitted prices
    const menuItemIds = items.map((i) => i.menuItemId)
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds }, isAvailable: true })
      .populate('category', 'name')
      .lean()

    const menuMap = Object.fromEntries(menuItems.map((m) => [m._id.toString(), m]))

    const resolvedItems = []
    for (const item of items) {
      const menu = menuMap[item.menuItemId]
      if (!menu) {
        return res.status(400).json({
          success: false,
          message: `Menu item "${item.menuItemId}" is not available or does not exist`,
        })
      }
      const quantity = Math.max(1, parseInt(item.quantity))
      const lineTotal = menu.price * quantity
      resolvedItems.push({
        menuItemId: menu._id,
        name: menu.name,
        categoryName: menu.category?.name || '',
        unitPrice: menu.price,
        unitCost: menu.costPrice ?? null,   // snapshot cost price (null if unknown)
        quantity,
        lineTotal,
      })
    }

    const subtotal = resolvedItems.reduce((s, i) => s + i.lineTotal, 0)
    const total = subtotal // No tax/discount in this version

    const orderNumber = await generateOrderNumber()

    const order = await Order.create({
      orderNumber,
      customerName: customerName || '',
      tableNumber: tableNumber || '',
      orderType,
      items: resolvedItems,
      subtotal,
      total,
      outstandingAmount: total,
      notes: notes || '',
      orderStatus: 'new',
      paymentStatus: 'pending',
    })

    res.status(201).json({ success: true, data: order, message: `Order ${orderNumber} created` })
  } catch (err) { next(err) }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const allowed = VALID_TRANSITIONS[order.orderStatus] || []
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${order.orderStatus}" to "${status}"`,
      })
    }

    order.orderStatus = status
    await order.save()

    res.json({ success: true, data: order, message: `Order status updated to ${status}` })
  } catch (err) { next(err) }
}

export async function cancelOrder(req, res, next) {
  try {
    const { reason } = req.body
    if (!reason) return res.status(400).json({ success: false, message: 'Cancellation reason is required' })

    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' })
    }
    if (order.orderStatus === 'served') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a served order' })
    }

    order.orderStatus = 'cancelled'
    order.cancellationReason = reason
    order.cancelledAt = new Date()
    await order.save()

    res.json({ success: true, data: order, message: 'Order cancelled' })
  } catch (err) { next(err) }
}
