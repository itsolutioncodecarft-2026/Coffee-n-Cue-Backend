import { Router } from 'express'
import { refundPayment } from '../controllers/paymentController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/:paymentId/refund', requireAuth, refundPayment)

export default router
