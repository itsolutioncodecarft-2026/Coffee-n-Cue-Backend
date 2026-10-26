import mongoose from 'mongoose'

const ExpenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },
    // Snapshot so historical records survive category edits
    categoryName: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },

    // Business date (when expense relates to, used for P&L)
    expenseDate: { type: Date, required: true },

    // Payment tracking
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid'],
      default: 'paid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'other'],
      default: 'cash',
    },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentDate: { type: Date, default: null },

    // Optional details
    vendor: { type: String, trim: true, default: '' },
    receiptNumber: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },

    // Audit trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
)

ExpenseSchema.index({ expenseDate: -1 })
ExpenseSchema.index({ category: 1, expenseDate: -1 })
ExpenseSchema.index({ paymentStatus: 1 })
ExpenseSchema.index({ paymentMethod: 1 })
ExpenseSchema.index({ archivedAt: 1 })

export default mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema)
