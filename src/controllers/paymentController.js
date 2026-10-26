import Payment from '../models/Payment.js'
import Order from '../models/Order.js'
import Customer from '../models/Customer.js'

export async function recordPayment(req, res, next) {
  try {
    const { amount, method, transactionRef, notes } = req.body
    const order = await Order.findById(req.params.id)

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot record payment for a cancelled order' })
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already fully paid' })
    }

    const outstanding = order.outstandingAmount
    if (amount > outstanding + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Amount ₹${amount} exceeds outstanding balance of ₹${outstanding.toFixed(2)}`,
      })
    }

    // Create payment record
    const payment = await Payment.create({
      order: order._id,
      amount,
      method,
      transactionRef: transactionRef || '',
      notes: notes || '',
      paidAt: new Date(),
      recordedBy: req.admin?.id || null,
      isRefund: false,
    })

    // Update order totals
    order.totalPaid = parseFloat((order.totalPaid + amount).toFixed(2))
    order.outstandingAmount = parseFloat((order.total - order.totalPaid).toFixed(2))
    if (order.outstandingAmount <= 0) {
      order.outstandingAmount = 0
      order.paymentStatus = 'paid'
    } else {
      order.paymentStatus = 'partial'
    }

    await order.save()

    // Reduce customer outstanding balance (khata) if this order has a customer name
    if (order.customerName && order.customerName.trim()) {
      const customer = await Customer.findOne({
        name: { $regex: `^${order.customerName.trim()}$`, $options: 'i' }
      })
      if (customer) {
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - amount)
        customer.totalPaid += amount
        await customer.save()
      }
    }

    res.status(201).json({
      success: true,
      data: { payment, order },
      message: `Payment of ₹${amount} recorded (${method.toUpperCase()})`,
    })
  } catch (err) { next(err) }
}

export async function getOrderPayments(req, res, next) {
  try {
    const order = await Order.findById(req.params.id).lean()
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    const payments = await Payment.find({ order: order._id }).sort({ paidAt: 1 }).lean()
    res.json({ success: true, data: payments })
  } catch (err) { next(err) }
}

export async function refundPayment(req, res, next) {
  try {
    const { paymentId } = req.params
    const { notes } = req.body

    const original = await Payment.findById(paymentId)
    if (!original) return res.status(404).json({ success: false, message: 'Payment not found' })
    if (original.isRefund) return res.status(400).json({ success: false, message: 'Cannot refund a refund' })

    const order = await Order.findById(original.order)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    // Create refund record
    const refund = await Payment.create({
      order: order._id,
      amount: original.amount,
      method: original.method,
      transactionRef: '',
      notes: notes || `Refund of payment ${original._id}`,
      paidAt: new Date(),
      recordedBy: req.admin?.id || null,
      isRefund: true,
      refundedPayment: original._id,
    })

    // Reverse on the order
    order.totalPaid = parseFloat((order.totalPaid - original.amount).toFixed(2))
    if (order.totalPaid < 0) order.totalPaid = 0
    order.outstandingAmount = parseFloat((order.total - order.totalPaid).toFixed(2))
    order.paymentStatus = order.totalPaid <= 0 ? 'pending' : 'partial'

    await order.save()

    res.json({ success: true, data: { refund, order }, message: 'Refund recorded' })
  } catch (err) { next(err) }
}
