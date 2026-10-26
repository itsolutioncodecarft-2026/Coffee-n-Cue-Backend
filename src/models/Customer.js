import mongoose from 'mongoose'

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    // Running outstanding balance (credit = positive means they owe money)
    outstandingBalance: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

CustomerSchema.index({ name: 1 })
CustomerSchema.index({ phone: 1 })
CustomerSchema.index({ outstandingBalance: -1 })

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema)
