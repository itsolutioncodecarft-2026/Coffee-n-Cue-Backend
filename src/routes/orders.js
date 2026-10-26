import { Router } from 'express'
import {
  listOrders, getOrder, createOrder, updateOrderStatus, cancelOrder, addItemsToOrder,
} from '../controllers/orderController.js'
import { recordPayment, getOrderPayments } from '../controllers/paymentController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, createOrderSchema, orderStatusSchema, cancelOrderSchema, paymentSchema } from '../validators/index.js'

const router = Router()

router.get('/', requireAuth, listOrders)
router.post('/', requireAuth, validate(createOrderSchema), createOrder)
router.get('/:id', requireAuth, getOrder)
router.patch('/:id/status', requireAuth, validate(orderStatusSchema), updateOrderStatus)
router.post('/:id/cancel', requireAuth, validate(cancelOrderSchema), cancelOrder)
router.patch('/:id/add-items', requireAuth, addItemsToOrder)

// Payment sub-routes
router.get('/:id/payments', requireAuth, getOrderPayments)
router.post('/:id/payments', requireAuth, validate(paymentSchema), recordPayment)

export default router
