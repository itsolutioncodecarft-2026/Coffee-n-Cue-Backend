/**
 * Seed Snooker/Billiards tables as menu items with customPrice=true.
 * Price is entered by staff at order time based on time played.
 * Run: node src/scripts/seed-snooker.js
 * Idempotent — skips if "Snooker" category already exists.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('MONGODB_URI not set')

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected to MongoDB')

  const slug = 'snooker'
  let category = await Category.findOne({ slug })

  if (!category) {
    category = await Category.create({
      name: 'Snooker',
      slug,
      sortOrder: 14,
      isActive: true,
    })
    console.log('  ✓  Created Snooker category')
  } else {
    console.log('  ℹ️  Snooker category already exists')
  }

  // Check if snooker items already exist
  const existing = await MenuItem.countDocuments({ category: category._id })
  if (existing > 0) {
    console.log(`  ℹ️  ${existing} snooker items already exist. Skipping.`)
    await mongoose.disconnect()
    return
  }

  // Create snooker table items with customPrice=true
  const tables = [
    { name: 'Snooker Table 1', price: 0 },
    { name: 'Snooker Table 2', price: 0 },
    { name: 'Snooker Table 3', price: 0 },
    { name: 'Snooker Table 4', price: 0 },
  ]

  for (const t of tables) {
    await MenuItem.create({
      name: t.name,
      category: category._id,
      price: t.price,
      customPrice: true,
      isAvailable: true,
    })
    console.log(`  ✓  ${t.name} (custom price)`)
  }

  console.log(`\n✅  Seeded ${tables.length} snooker tables (custom price items)`)
  await mongoose.disconnect()
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1) })
