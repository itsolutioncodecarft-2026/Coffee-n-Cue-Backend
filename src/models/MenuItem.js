import mongoose from 'mongoose'

const MenuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    price: { type: Number, required: true, min: 0 },
    // Optional estimated cost per unit. Null = unknown. Used for gross-profit estimates only.
    costPrice: { type: Number, min: 0, default: null },
    // When true, staff enters the price at order time (e.g. snooker tables — price varies by time played)
    customPrice: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
)

MenuItemSchema.index({ category: 1, isAvailable: 1 })
MenuItemSchema.index({ name: 'text' })

export default mongoose.models.MenuItem || mongoose.model('MenuItem', MenuItemSchema)
