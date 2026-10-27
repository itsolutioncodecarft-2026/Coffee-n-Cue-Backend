import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const menuItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  costPrice: z.coerce.number().min(0).optional(),
  customPrice: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
})

const orderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1').optional().default(1),
  customAmount: z.coerce.number().positive('Custom amount must be positive').optional(),
})

export const createOrderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(100),
  tableNumber: z.string().max(20).optional().default(''),
  orderType: z.enum(['dine-in', 'takeaway'], { message: 'Order type must be dine-in or takeaway' }),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  notes: z.string().max(500).optional().default(''),
})

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'upi', 'credit'], { message: 'Method must be cash, upi, or credit' }),
  transactionRef: z.string().max(200).optional().default(''),
  notes: z.string().max(500).optional().default(''),
})

export const orderStatusSchema = z.object({
  status: z.enum(['new', 'preparing', 'ready', 'served', 'cancelled']),
})

export const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

export const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  period: z.enum(['today', 'month', 'custom']).optional().default('today'),
})

/** Middleware factory that validates req.body against a Zod schema */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      return res.status(400).json({ success: false, message: 'Validation error', errors })
    }
    req.body = result.data
    next()
  }
}

/** Middleware factory that validates req.query against a Zod schema */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      return res.status(400).json({ success: false, message: 'Validation error', errors })
    }
    req.validatedQuery = result.data
    next()
  }
}
