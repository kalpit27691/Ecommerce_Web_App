import bcrypt from 'bcrypt';
import { Category } from './models/categorymodel.js';
import { Product } from './models/productmodel.js';
import { Inventory } from './models/inventorymodel.js';
import { User } from './models/usermodel.js';

const catalog = [
  { category: 'Audio', categoryDescription: 'Sound that moves with you.', name: 'Studio Headphones', price: 129, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', stock: 18, description: 'Immersive wireless sound, soft memory-foam cushions, and a 30-hour battery for everyday listening.' },
  { category: 'Workspace', categoryDescription: 'Thoughtful tools for focused work.', name: 'Arc Desk Lamp', price: 89, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85', stock: 12, description: 'A warm, adjustable glow with a sculptural silhouette. Made for late-night ideas and slow mornings.' },
  { category: 'Everyday', categoryDescription: 'The little things, made better.', name: 'Everyday Carry Bag', price: 74, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=85', stock: 24, description: 'A durable, water-resistant companion with smart pockets for the essentials you take everywhere.' },
  { category: 'Workspace', categoryDescription: 'Thoughtful tools for focused work.', name: 'Ceramic Planter', price: 38, image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=85', stock: 30, description: 'Hand-finished ceramic with a clean, considered form. A little more life for your favorite corner.' },
  { category: 'Audio', categoryDescription: 'Sound that moves with you.', name: 'Portable Speaker', price: 96, image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85', stock: 16, description: 'Room-filling sound in a pocket-sized body, with a rugged finish and all-day playtime.' },
  { category: 'Everyday', categoryDescription: 'The little things, made better.', name: 'Soft Knit Throw', price: 112, image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85', stock: 9, description: 'A tactile, generous knit that makes staying in feel like the best plan.' },
  { category: 'Workspace', categoryDescription: 'Thoughtful tools for focused work.', name: 'Minimal Notebook Set', price: 24, image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85', stock: 45, description: 'Three lay-flat notebooks with smooth, recycled pages—ready for whatever is on your mind.' },
  { category: 'Everyday', categoryDescription: 'The little things, made better.', name: 'Daily Water Bottle', price: 42, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85', stock: 27, description: 'Double-wall insulated stainless steel keeps your drink at just the right temperature.' },
];

export async function seedStore() {
  const categoryIds = new Map();
  for (const item of catalog) {
    let category = await Category.findOne({ name: item.category });
    if (!category) category = await Category.create({ name: item.category, description: item.categoryDescription });
    categoryIds.set(item.category, category._id);
  }

  for (const item of catalog) {
    let product = await Product.findOne({ name: item.name });
    if (!product) {
      product = await Product.create({
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        categoryId: categoryIds.get(item.category),
      });
    }
    await Inventory.updateOne({ productId: product._id }, { $setOnInsert: { quantity: item.stock } }, { upsert: true });
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const password = await bcrypt.hash(adminPassword, 10);
    await User.updateOne(
      { email: adminEmail },
      { $set: { email: adminEmail, password, name: 'Store admin', role: 'admin' } },
      { upsert: true },
    );
    console.log(`Admin account ready: ${adminEmail}`);
  }
}
