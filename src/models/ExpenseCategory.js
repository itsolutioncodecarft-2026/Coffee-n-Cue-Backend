import mongoose from 'mongoose'

const ExpenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    description: { type: String, default: '' },
  },
  { timestamps: true }
)

ExpenseCategorySchema.index({ isActive: 1, sortOrder: 1 })

export default mongoose.models.ExpenseCategory ||
  mongoose.model('ExpenseCategory', ExpenseCategorySchema)
