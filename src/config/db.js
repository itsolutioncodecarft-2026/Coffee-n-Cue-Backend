import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined')
}

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) return

  try {
    await mongoose.connect(MONGODB_URI, { bufferCommands: false })
    console.log('✅  MongoDB connected:', mongoose.connection.host)
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message)
    process.exit(1)
  }
}
