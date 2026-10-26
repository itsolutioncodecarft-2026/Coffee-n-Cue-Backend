/**
 * Idempotent menu seed script.
 * - If the database already has categories and menu items, it will NOT overwrite them.
 * - Safe to run multiple times — will not create duplicates.
 * - To RESET all menu data: run with --reset flag: node src/scripts/seed-menu.js --reset
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import MenuItem from '../models/MenuItem.js'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('MONGODB_URI not set in .env')

const MENU_DATA = [
  {
    name: 'Chinese',
    sortOrder: 1,
    items: [
      { name: 'Steam Momos', price: 80 },
      { name: 'Fried Momos', price: 90 },
      { name: 'Chilli Potato', price: 100 },
      { name: 'Cheese Shots', price: 100 },
      { name: 'Honey Chilli Potato', price: 120 },
    ],
  },
  {
    name: 'Maggi',
    sortOrder: 2,
    items: [
      { name: 'Plain Maggi', price: 60 },
      { name: 'Masala Maggi', price: 70 },
      { name: 'Cheese Maggi', price: 80 },
    ],
  },
  {
    name: 'French Fries',
    sortOrder: 3,
    items: [
      { name: 'Salted French Fries', price: 70 },
      { name: 'Peri-Peri French Fries', price: 80 },
    ],
  },
  {
    name: 'Sandwich',
    sortOrder: 4,
    items: [
      { name: 'Bombay Sandwich', price: 70 },
      { name: 'Veg. Cheese Grilled Sandwich', price: 80 },
      { name: 'Paneer Grilled Sandwich', price: 90 },
    ],
  },
  {
    name: 'Burger',
    sortOrder: 5,
    items: [
      { name: 'Aloo Tikki Burger', price: 60 },
      { name: 'Veggie Burger', price: 70 },
    ],
  },
  {
    name: 'Pizza',
    sortOrder: 6,
    items: [
      { name: 'Margherita Pizza', price: 120 },
      { name: 'OTC Pizza', price: 140 },
      { name: 'Paneer Pizza', price: 140 },
    ],
  },
  {
    name: 'Pasta',
    sortOrder: 7,
    items: [
      { name: 'Arrabbiata Red Pasta', price: 120 },
      { name: 'Alfredo (White Sauce Pasta)', price: 140 },
      { name: 'Pink Sauce Pasta', price: 150 },
    ],
  },
  {
    name: 'Maska Buns',
    sortOrder: 8,
    items: [
      { name: 'Bread Butter', price: 30 },
      { name: 'Butter Bun', price: 30 },
      { name: 'Masala Bun', price: 40 },
    ],
  },
  {
    name: 'Combos',
    sortOrder: 9,
    items: [
      { name: 'Burger + Cold Coffee', price: 99 },
      { name: 'Masala Maggi + Cold Coffee', price: 109 },
      { name: 'Grill Sandwich + Cold Coffee', price: 119 },
      { name: 'Cheese Shots + Cold Coffee', price: 159 },
      { name: 'OTC Pizza + French Fries + Cold Coffee', price: 249 },
    ],
  },
  {
    name: 'Tea',
    sortOrder: 10,
    items: [
      { name: 'Tea', price: 20 },
      { name: 'Kulhad Tea', price: 30 },
      { name: 'Green Tea', price: 30 },
      { name: 'Lemon Tea', price: 30 },
      { name: 'Lemon Ice Tea', price: 50 },
      { name: 'Peach Ice Tea', price: 60 },
    ],
  },
  {
    name: 'Coffee',
    sortOrder: 11,
    items: [
      { name: 'Black Coffee', price: 40 },
      { name: 'Hot Coffee', price: 40 },
      { name: 'Butter Hot Coffee', price: 50 },
      { name: 'Cold Coffee', price: 70 },
      { name: 'Cold Coffee Large', price: 90 },
      { name: 'Hot Chocolate', price: 80 },
      { name: 'Cold Coffee with Ice Cream', price: 100 },
    ],
  },
  {
    name: 'Shake',
    sortOrder: 12,
    items: [
      { name: 'Banana', price: 70 },
      { name: 'Vanilla', price: 70 },
      { name: 'Mango', price: 70 },
      { name: 'Chocolate', price: 80 },
      { name: 'Oreo', price: 90 },
      { name: 'Bourbon Shake', price: 90 },
    ],
  },
  {
    name: 'Mocktails',
    sortOrder: 13,
    items: [
      { name: 'Fresh Lemonade', price: 70 },
      { name: 'Mint Mojito', price: 80 },
      { name: 'Virgin Mojito', price: 90 },
    ],
  },
]

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

async function seed() {
  const args = process.argv.slice(2)
  const RESET = args.includes('--reset')

  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected to MongoDB')

  if (RESET) {
    await Category.deleteMany({})
    await MenuItem.deleteMany({})
    console.log('🗑️   Cleared all categories and menu items (--reset flag)')
  }

  // Check if data already exists
  const existingCount = await MenuItem.countDocuments()
  if (existingCount > 0 && !RESET) {
    console.log(`ℹ️   Database already has ${existingCount} menu items. Skipping seed.`)
    console.log('    Run with --reset to clear and re-seed: node src/scripts/seed-menu.js --reset')
    await mongoose.disconnect()
    return
  }

  let totalItems = 0

  for (const cat of MENU_DATA) {
    const slug = slugify(cat.name)
    const category = await Category.findOneAndUpdate(
      { slug },
      { name: cat.name, slug, sortOrder: cat.sortOrder, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    for (const item of cat.items) {
      await MenuItem.findOneAndUpdate(
        { name: item.name, category: category._id },
        { name: item.name, category: category._id, price: item.price, isAvailable: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      totalItems++
    }

    console.log(`  ✓  ${cat.name} (${cat.items.length} items)`)
  }

  console.log(`\n✅  Seeded ${totalItems} menu items across ${MENU_DATA.length} categories`)
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
