export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  if (err.name === 'ValidationError') {
    // Mongoose validation error
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    )
    return res.status(400).json({ success: false, message: 'Validation error', errors })
  }

  if (err.code === 11000) {
    // Duplicate key
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    return res.status(409).json({ success: false, message: `${field} already exists` })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' })
  }

  const status = err.status || err.statusCode || 500
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  })
}

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
}
