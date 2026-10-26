import { Router } from 'express'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, categorySchema } from '../validators/index.js'

const router = Router()

router.get('/', requireAuth, listCategories)
router.post('/', requireAuth, validate(categorySchema), createCategory)
router.patch('/:id', requireAuth, validate(categorySchema.partial()), updateCategory)
router.delete('/:id', requireAuth, deleteCategory)

export default router
