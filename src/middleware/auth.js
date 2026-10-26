import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export function requireAuth(req, res, next) {
  // 1. Try HTTP-only cookie first
  const cookieToken = req.cookies?.cnc_auth

  // 2. Fall back to Authorization Bearer header (used when cookie is blocked cross-domain)
  const bearerToken = extractBearerToken(req)

  const token = cookieToken || bearerToken

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' })
  }
}

function extractBearerToken(req) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}
