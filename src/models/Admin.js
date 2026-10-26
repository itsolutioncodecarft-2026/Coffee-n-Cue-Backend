import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const AdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
)

AdminSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash)
}

AdminSchema.statics.hashPassword = async function (plain) {
  return bcrypt.hash(plain, 12)
}

export default mongoose.models.Admin || mongoose.model('Admin', AdminSchema)
