/**
 * Idempotent expense category seed.
 * Run: node src/scripts/seed-expense-categories.js
 * Safe to re-run — skips if categories already exist.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import ExpenseCategory from '../models/ExpenseCategory.js'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('MONGODB_URI not set')

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

const DEFAULT_CATEGORIES = [
  { name: 'Raw Materials / Food Supplies', sortOrder: 1 },
  { name: 'Vegetables and Groceries', sortOrder: 2 },
  { name: 'Milk and Dairy', sortOrder: 3 },
  { name: 'Coffee and Beverages', sortOrder: 4 },
  { name: 'Packaging', sortOrder: 5 },
  { name: 'Electricity', sortOrder: 6 },
  { name: 'Water', sortOrder: 7 },
  { name: 'Gas', sortOrder: 8 },
  { name: 'Rent', sortOrder: 9 },
  { name: 'Staff Salary', sortOrder: 10 },
  { name: 'Maintenance and Repairs', sortOrder: 11 },
  { name: 'Cleaning Supplies', sortOrder: 12 },
  { name: 'Internet and Phone', sortOrder: 13 },
  { name: 'Transportation', sortOrder: 14 },
  { name: 'Equipment', sortOrder: 15 },
  { name: 'Marketing', sortOrder: 16 },
  { name: 'Miscellaneous', sortOrder: 17 },
]

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected to MongoDB')

  const existing = await ExpenseCategory.countDocuments()
  if (existing > 0) {
    console.log(`ℹ️   ${existing} expense categories already exist. Skipping seed.`)
    await mongoose.disconnect()
    return
  }

  for (const cat of DEFAULT_CATEGORIES) {
    await ExpenseCategory.findOneAndUpdate(
      { slug: slugify(cat.name) },
      { name: cat.name, slug: slugify(cat.name), sortOrder: cat.sortOrder, isActive: true },
      { upsert: true, new: true }
    )
    console.log(`  ✓  ${cat.name}`)
  }

  console.log(`\n✅  Seeded ${DEFAULT_CATEGORIES.length} expense categories`)
  await mongoose.disconnect()
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1) })
