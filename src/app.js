import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import menuRoutes from './routes/menu.js'
import orderRoutes from './routes/orders.js'
import paymentRoutes from './routes/payments.js'
import dashboardRoutes from './routes/dashboard.js'
import reportRoutes from './routes/reports.js'
import expenseRoutes from './routes/expenses.js'
import expenseCategoryRoutes from './routes/expenseCategories.js'
import customerRoutes from './routes/customers.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

// ── Security headers ───────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// ── CORS — supports multiple allowed origins via env ──────────────────
// FRONTEND_URL can be comma-separated for multiple origins:
// e.g. "https://coffee-n-cue.vercel.app,http://localhost:3000"
const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:3000'
const allowedOrigins = [
  ...rawOrigins.split(',').map(o => o.trim()),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS blocked: ${origin}`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ── Body parsing & cookies ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── Logging ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

// ── Health check ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Coffee N Cue API is running',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// ── API Routes ─────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/expense-categories', expenseCategoryRoutes)
app.use('/api/customers', customerRoutes)

// ── 404 & Error handling ───────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

export default app
