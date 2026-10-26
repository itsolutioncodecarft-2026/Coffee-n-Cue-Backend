import { Router } from 'express'
import {
  listExpenses, getExpense, createExpense,
  updateExpense, archiveExpense,
} from '../controllers/expenseController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../validators/index.js'
import { z } from 'zod'

const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  expenseDate: z.string().min(1, 'Expense date is required'),
  paymentStatus: z.enum(['paid', 'unpaid']).optional().default('paid'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional().default('cash'),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentDate: z.string().optional(),
  vendor: z.string().max(200).optional().default(''),
  receiptNumber: z.string().max(100).optional().default(''),
  description: z.string().max(500).optional().default(''),
})

const router = Router()

router.get('/', requireAuth, listExpenses)
router.post('/', requireAuth, validate(createExpenseSchema), createExpense)
router.get('/:id', requireAuth, getExpense)
router.patch('/:id', requireAuth, validate(createExpenseSchema.partial()), updateExpense)
router.delete('/:id', requireAuth, archiveExpense)

export default router
