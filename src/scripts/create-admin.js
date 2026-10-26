/**
 * Create or update the first admin account.
 * Reads credentials from environment variables.
 * Safe to run multiple times — will not create duplicates.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import Admin from '../models/Admin.js'

const MONGODB_URI = process.env.MONGODB_URI
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD
const USERNAME = process.env.ADMIN_USERNAME || 'Admin'

if (!MONGODB_URI) throw new Error('MONGODB_URI not set')
if (!EMAIL || !PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env')
if (PASSWORD.length < 6) throw new Error('Admin password must be at least 6 characters')

async function createAdmin() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected to MongoDB')

  const existing = await Admin.findOne({ email: EMAIL.toLowerCase() })
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  if (existing) {
    existing.passwordHash = passwordHash
    existing.username = USERNAME
    await existing.save()
    console.log(`✅  Admin updated: ${EMAIL}`)
  } else {
    await Admin.create({ email: EMAIL.toLowerCase(), username: USERNAME, passwordHash })
    console.log(`✅  Admin created: ${EMAIL}`)
  }

  await mongoose.disconnect()
}

createAdmin().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
