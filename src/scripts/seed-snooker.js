/**
 * Seed Snooker/Pool tables as menu items with customPrice=true.
 * Price is entered by staff at order time based on time played.
 * Run: node src/scripts/seed-snooker.js
 * Run with --reset to clear and re-seed: node src/scripts/seed-snooker.js --reset
 *
 * Actual tables in Coffee N Cue:
 *   - 3 Snooker Tables
 *   - 1 Pool Table
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

const TABLES = [
  { name: 'Snooker Table 1' },
  { name: 'Snooker Table 2' },
  { name: 'Snooker Table 3' },
  { name: 'Pool Table 1' },
]

async function seed() {
  const RESET = process.argv.includes('--reset')
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected to MongoDB')

  const slug = 'snooker'
  let category = await Category.findOne({ slug })

  if (!category) {
    category = await Category.create({ name: 'Snooker', slug, sortOrder: 14, isActive: true })
    console.log('  ✓  Created Snooker category')
  } else {
    console.log('  ℹ️  Snooker category already exists')
  }

  if (RESET) {
    await MenuItem.deleteMany({ category: category._id })
    console.log('  🗑️   Cleared existing table items')
  }

  const existing = await MenuItem.countDocuments({ category: category._id })
  if (existing > 0 && !RESET) {
    console.log(`  ℹ️  ${existing} table items already exist. Skipping.`)
    console.log('     Run with --reset to re-seed: node src/scripts/seed-snooker.js --reset')
    await mongoose.disconnect()
    return
  }

  for (const t of TABLES) {
    await MenuItem.create({
      name: t.name,
      category: category._id,
      price: 0,
      customPrice: true,
      isAvailable: true,
    })
    console.log(`  ✓  ${t.name} (custom price — staff enters charge at order time)`)
  }

  console.log(`\n✅  Seeded ${TABLES.length} tables (3 Snooker + 1 Pool)`)
  await mongoose.disconnect()
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1) })
