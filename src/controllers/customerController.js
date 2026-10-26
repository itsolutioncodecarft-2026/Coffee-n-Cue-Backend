import Customer from '../models/Customer.js'

/**
 * List customers — optionally filter to only those with outstanding balance
 */
export async function listCustomers(req, res, next) {
  try {
    const { search, outstandingOnly, page = 1, limit = 50 } = req.query
    const filter = {}
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }
    if (outstandingOnly === 'true') {
      filter.outstandingBalance = { $gt: 0 }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ outstandingBalance: -1, updatedAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Customer.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: customers,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
}

/**
 * Get a single customer with their transaction history
 */
export async function getCustomer(req, res, next) {
  try {
    const customer = await Customer.findById(req.params.id).lean()
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

    // Find all orders for this customer
    const Order = (await import('../models/Order.js')).default
    const Payment = (await import('../models/Payment.js')).default

    const customerOrders = await Order.find({
      $or: [
        { customerName: { $regex: `^${customer.name}$`, $options: 'i' } },
        { customer: customer._id },
      ],
    }).sort({ createdAt: -1 }).lean()

    // Get payments for those orders
    const orderIds = customerOrders.map(o => o._id)
    const orderPayments = await Payment.find({ order: { $in: orderIds } }).sort({ paidAt: 1 }).lean()

    res.json({
      success: true,
      data: { customer, orders: customerOrders, payments: orderPayments },
    })
  } catch (err) { next(err) }
}

/**
 * Record a direct payment from a customer (clearing their credit/khata)
 * This is separate from order-level payments — it's a customer-level payment.
 */
export async function recordCustomerPayment(req, res, next) {
  try {
    const { amount, method, notes } = req.body
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' })
    }

    const customer = await Customer.findById(req.params.id)
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

    const payAmount = parseFloat(amount)
    if (payAmount > customer.outstandingBalance + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Amount ₹${payAmount} exceeds outstanding balance of ₹${customer.outstandingBalance.toFixed(2)}`,
      })
    }

    // Reduce customer's outstanding balance
    customer.outstandingBalance = Math.max(0, customer.outstandingBalance - payAmount)
    customer.totalPaid += payAmount
    await customer.save()

    // Create a payment record linked to the customer
    const Payment = (await import('../models/Payment.js')).default

    // Find the oldest unpaid order for this customer to attach payment to
    const Order = (await import('../models/Order.js')).default
    const unpaidOrders = await Order.find({
      $or: [
        { customerName: { $regex: `^${customer.name}$`, $options: 'i' } },
        { customer: customer._id },
      ],
      paymentStatus: { $in: ['pending', 'partial'] },
      orderStatus: { $ne: 'cancelled' },
    }).sort({ createdAt: 1 }).lean()

    // Distribute the payment across unpaid orders (oldest first)
    let remaining = payAmount
    for (const order of unpaidOrders) {
      if (remaining <= 0) break
      const outstanding = order.outstandingAmount
      if (outstanding <= 0) continue

      const allocation = Math.min(remaining, outstanding)

      // Create payment record
      await Payment.create({
        order: order._id,
        amount: allocation,
        method: method || 'cash',
        transactionRef: notes || `Customer payment from ${customer.name}`,
        notes: `Customer khata payment — ${customer.name}`,
        paidAt: new Date(),
        recordedBy: req.admin?.id || null,
        isRefund: false,
      })

      // Update order
      const updatedOrder = await Order.findById(order._id)
      updatedOrder.totalPaid = parseFloat((updatedOrder.totalPaid + allocation).toFixed(2))
      updatedOrder.outstandingAmount = parseFloat((updatedOrder.total - updatedOrder.totalPaid).toFixed(2))
      if (updatedOrder.outstandingAmount <= 0) {
        updatedOrder.outstandingAmount = 0
        updatedOrder.paymentStatus = 'paid'
      } else {
        updatedOrder.paymentStatus = 'partial'
      }
      await updatedOrder.save()

      remaining -= allocation
    }

    res.json({
      success: true,
      data: customer,
      message: `₹${payAmount} recorded from ${customer.name} via ${method?.toUpperCase() || 'CASH'}`,
    })
  } catch (err) { next(err) }
}

/**
 * Create or update customer when an order is placed on credit
 * Called internally from orderController — not a route
 */
export async function upsertCustomerOnOrder(customerName, orderTotal, order) {
  if (!customerName || !customerName.trim()) return null

  const name = customerName.trim()
  let customer = await Customer.findOne({ name: { $regex: `^${name}$`, $options: 'i' } })

  if (customer) {
    customer.outstandingBalance += orderTotal
    customer.totalSpent += orderTotal
    await customer.save()
    // Link order to customer
    order.customer = customer._id
    await order.save()
    return customer
  }

  customer = await Customer.create({
    name,
    outstandingBalance: orderTotal,
    totalSpent: orderTotal,
  })
  order.customer = customer._id
  await order.save()
  return customer
}

/**
 * Reduce customer outstanding when a payment is recorded on an order
 */
export async function reduceCustomerOutstanding(order, amount) {
  if (!order.customerName || !order.customerName.trim()) return

  const name = order.customerName.trim()
  const customer = await Customer.findOne({ name: { $regex: `^${name}$`, $options: 'i' } })
  if (customer) {
    customer.outstandingBalance = Math.max(0, customer.outstandingBalance - amount)
    customer.totalPaid += amount
    await customer.save()
  }
}

/**
 * Create a new customer manually
 */
export async function createCustomer(req, res, next) {
  try {
    const { name, phone, notes } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' })
    }

    const existing = await Customer.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Customer with this name already exists' })
    }

    const customer = await Customer.create({
      name: name.trim(),
      phone: phone || '',
      notes: notes || '',
    })

    res.status(201).json({ success: true, data: customer })
  } catch (err) { next(err) }
}

/**
 * Update customer details
 */
export async function updateCustomer(req, res, next) {
  try {
    const { name, phone, notes } = req.body
    const customer = await Customer.findById(req.params.id)
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })

    if (name) customer.name = name.trim()
    if (phone !== undefined) customer.phone = phone
    if (notes !== undefined) customer.notes = notes
    await customer.save()

    res.json({ success: true, data: customer })
  } catch (err) { next(err) }
}
