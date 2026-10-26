import { Router } from 'express'
import {
  listCustomers, getCustomer, recordCustomerPayment,
  createCustomer, updateCustomer,
} from '../controllers/customerController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../validators/index.js'
import { z } from 'zod'

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'upi'], { message: 'Method must be cash or upi' }),
  notes: z.string().max(500).optional().default(''),
})

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().max(20).optional().default(''),
  notes: z.string().max(500).optional().default(''),
})

const router = Router()

router.get('/', requireAuth, listCustomers)
router.post('/', requireAuth, validate(createCustomerSchema), createCustomer)
router.get('/:id', requireAuth, getCustomer)
router.patch('/:id', requireAuth, validate(createCustomerSchema.partial()), updateCustomer)
router.post('/:id/payment', requireAuth, validate(paymentSchema), recordCustomerPayment)

export default router
