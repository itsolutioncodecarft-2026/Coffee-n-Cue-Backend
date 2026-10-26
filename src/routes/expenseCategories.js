import { Router } from 'express'
import {
  listExpenseCategories, createExpenseCategory,
  updateExpenseCategory, deleteExpenseCategory,
} from '../controllers/expenseCategoryController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../validators/index.js'
import { z } from 'zod'

const expCatSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(300).optional(),
})

const router = Router()

router.get('/', requireAuth, listExpenseCategories)
router.post('/', requireAuth, validate(expCatSchema), createExpenseCategory)
router.patch('/:id', requireAuth, validate(expCatSchema.partial()), updateExpenseCategory)
router.delete('/:id', requireAuth, deleteExpenseCategory)

export default router
