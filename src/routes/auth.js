import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, logout, me } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, loginSchema } from '../validators/index.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/login', loginLimiter, validate(loginSchema), login)
router.post('/logout', logout)
router.get('/me', requireAuth, me)

export default router
