import jwt from 'jsonwebtoken'
import Admin from '../models/Admin.js'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const COOKIE_NAME = 'cnc_auth'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

function cookieOptions(remember = true) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: remember ? COOKIE_MAX_AGE : undefined,
    path: '/',
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body

    const admin = await Admin.findOne({ email: email.toLowerCase() })
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const valid = await admin.comparePassword(password)
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const token = jwt.sign(
      { id: admin._id.toString(), email: admin.email, username: admin.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.cookie(COOKIE_NAME, token, cookieOptions(true))

    return res.json({
      success: true,
      message: 'Login successful',
      admin: { id: admin._id, email: admin.email, username: admin.username },
    })
  } catch (err) {
    next(err)
  }
}

export async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
  res.json({ success: true, message: 'Logged out' })
}

export async function me(req, res) {
  // req.admin is set by requireAuth middleware
  const { id, email, username } = req.admin
  res.json({ success: true, admin: { id, email, username } })
}
