import mongoose from 'mongoose'

const PaymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'upi', 'credit'], required: true },
    transactionRef: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    isRefund: { type: Boolean, default: false },
    refundedPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  },
  { timestamps: true }
)

PaymentSchema.index({ order: 1 })
PaymentSchema.index({ paidAt: -1 })
PaymentSchema.index({ method: 1, paidAt: -1 })
PaymentSchema.index({ isRefund: 1 })

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema)
