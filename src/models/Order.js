import mongoose from 'mongoose'

const OrderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
    name: { type: String, required: true },
    categoryName: { type: String, default: '' },
    unitPrice: { type: Number, required: true, min: 0 },
    // Snapshot of costPrice at order time. Null = cost unknown at order time.
    unitCost: { type: Number, min: 0, default: null },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const OrderSchema = new mongoose.Schema(
  {
    // unique: true on the field creates the index; no need for schema.index({ orderNumber: 1 })
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, trim: true, default: '' },
    tableNumber: { type: String, trim: true, default: '' },
    orderType: { type: String, enum: ['dine-in', 'takeaway'], required: true },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    orderStatus: {
      type: String,
      enum: ['new', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'new',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded'],
      default: 'pending',
    },
    totalPaid: { type: Number, default: 0, min: 0 },
    outstandingAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
)

OrderSchema.index({ createdAt: -1 })
OrderSchema.index({ orderStatus: 1 })
OrderSchema.index({ paymentStatus: 1 })

export default mongoose.models.Order || mongoose.model('Order', OrderSchema)
