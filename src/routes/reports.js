import { Router } from 'express'
import {
  reportSummary, exportOrders, exportMonthlySummary,
  exportDaily, exportCustom,
} from '../controllers/reportController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/summary', requireAuth, reportSummary)
router.get('/export/orders', requireAuth, exportOrders)
router.get('/export/monthly', requireAuth, exportMonthlySummary)
router.get('/export/daily', requireAuth, exportDaily)
router.get('/export/custom', requireAuth, exportCustom)

export default router
