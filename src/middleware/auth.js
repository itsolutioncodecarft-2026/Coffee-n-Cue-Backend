import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export function requireAuth(req, res, next) {
  // Accept token from HTTP-only cookie or Authorization header
  const token = req.cookies?.cnc_auth || extractBearerToken(req)

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.admin = decoded
    next()
  } catch (err) {
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
