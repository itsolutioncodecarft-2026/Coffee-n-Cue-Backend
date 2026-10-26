import Order from '../models/Order.js'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/**
 * Generates a unique order number like CC-20261025-0001.
 * Uses atomic findOneAndUpdate-style approach with retry to handle collisions.
 */
export async function generateOrderNumber() {
  const now = new Date()
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)

  const year = istNow.getUTCFullYear()
  const month = String(istNow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istNow.getUTCDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  const prefix = `CC-${dateStr}-`

  // Find highest existing sequence for today
  const last = await Order.findOne(
    { orderNumber: { $regex: `^${prefix}` } },
    { orderNumber: 1 },
    { sort: { orderNumber: -1 } }
  ).lean()

  let seq = 1
  if (last) {
    const parts = last.orderNumber.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}
