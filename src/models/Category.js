import mongoose from 'mongoose'

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Only add non-unique composite indexes here; slug unique index is defined in the schema field
CategorySchema.index({ isActive: 1, sortOrder: 1 })

export default mongoose.models.Category || mongoose.model('Category', CategorySchema)
