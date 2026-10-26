import { Router } from 'express'
import { listMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, menuItemSchema } from '../validators/index.js'

const router = Router()

router.get('/', requireAuth, listMenu)
router.post('/', requireAuth, validate(menuItemSchema), createMenuItem)
router.get('/:id', requireAuth, getMenuItem)
router.patch('/:id', requireAuth, validate(menuItemSchema.partial()), updateMenuItem)
router.delete('/:id', requireAuth, deleteMenuItem)

export default router
