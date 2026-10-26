import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'

const PORT = process.env.PORT || 5000

async function start() {
  await connectDB()
  app.listen(PORT, () => {
    console.log(`🚀  Coffee N Cue API running at http://localhost:${PORT}`)
    console.log(`    Health: http://localhost:${PORT}/api/health`)
    console.log(`    Env:    ${process.env.NODE_ENV}`)
  })
}

start()
