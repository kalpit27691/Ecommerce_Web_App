import express from 'express';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { User } from '../models/usermodel.js';
import { Product } from '../models/productmodel.js';
import { Category } from '../models/categorymodel.js';
import { Inventory } from '../models/inventorymodel.js';
import { Cart } from '../models/cardmodel.js';
import { Order } from '../models/ordermodel.js';
import { createToken, requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();
const validId = (id) => Types.ObjectId.isValid(id);
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });

async function cartDetails(userId) {
  const cart = await Cart.findOne({ userId }).populate('items.productId');
  if (!cart) return { items: [], subtotal: 0, itemCount: 0 };
  const inventory = await Inventory.find({ productId: { $in: cart.items.map((item) => item.productId?._id).filter(Boolean) } });
  const stockByProduct = new Map(inventory.map((entry) => [entry.productId.toString(), entry.quantity]));
  const items = cart.items.filter((item) => item.productId?.isActive).map((item) => ({
    product: item.productId,
    quantity: item.quantity,
    stock: stockByProduct.get(item.productId._id.toString()) || 0,
    subtotal: item.productId.price * item.quantity,
  }));
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with that email already exists.' });
  const user = await User.create({ name: name.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
});

router.post('/auth/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  res.json({ token: createToken(user), user: publicUser(user) });
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: 'This account is no longer available.' });
  res.json({ user: publicUser(user) });
});

router.get('/categories', async (_req, res) => {
  res.json(await Category.find().sort({ name: 1 }));
});

router.post('/categories', requireAuth, requireAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ message: 'Category name is required.' });
  res.status(201).json(await Category.create({ name, description: req.body.description || '' }));
});

router.patch('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid category id.' });
  const category = await Category.findByIdAndUpdate(req.params.id, {
    name: req.body.name?.trim(),
    description: req.body.description,
  }, { new: true, runValidators: true });
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  res.json(category);
});

router.delete('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid category id.' });
  if (await Product.exists({ categoryId: req.params.id, isActive: true })) {
    return res.status(409).json({ message: 'Move or archive this category’s products before deleting it.' });
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  res.json({ message: 'Category deleted.' });
});

router.get('/products', async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category && req.query.category !== 'all') filter.categoryId = req.query.category;
  if (req.query.search) filter.name = { $regex: String(req.query.search).slice(0, 80), $options: 'i' };
  const products = await Product.find(filter).populate('categoryId', 'name').sort({ createdAt: -1 });
  const inventory = await Inventory.find({ productId: { $in: products.map((product) => product._id) } });
  const stock = new Map(inventory.map((entry) => [entry.productId.toString(), entry.quantity]));
  res.json(products.map((product) => ({ ...product.toObject(), stock: stock.get(product._id.toString()) || 0 })));
});

router.get('/products/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid product id.' });
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).populate('categoryId', 'name');
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  const inventory = await Inventory.findOne({ productId: product._id });
  res.json({ ...product.toObject(), stock: inventory?.quantity || 0 });
});

router.post('/products', requireAuth, requireAdmin, async (req, res) => {
  const { name, description, price, categoryId, image } = req.body;
  if (!name?.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !validId(categoryId)) {
    return res.status(400).json({ message: 'Name, a valid non-negative price, and category are required.' });
  }
  if (!(await Category.exists({ _id: categoryId }))) return res.status(400).json({ message: 'Choose an existing category.' });
  const product = await Product.create({ name: name.trim(), description, price: Number(price), categoryId, image });
  await Inventory.create({ productId: product._id, quantity: Math.max(0, Math.floor(Number(req.body.stock) || 0)) });
  res.status(201).json(await Product.findById(product._id).populate('categoryId', 'name'));
});

router.patch('/products/:id', requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid product id.' });
  const existingProduct = await Product.findById(req.params.id);
  if (!existingProduct) return res.status(404).json({ message: 'Product not found.' });
  let stockQuantity;
  if (req.body.stock !== undefined) {
    stockQuantity = Number(req.body.stock);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) return res.status(400).json({ message: 'Stock must be a non-negative whole number.' });
    const inventory = await Inventory.findOne({ productId: existingProduct._id });
    if (stockQuantity < (inventory?.reservedQuantity || 0)) return res.status(409).json({ message: 'Stock cannot be lower than reserved inventory.' });
  }
  const updates = {};
  for (const field of ['name', 'description', 'image', 'categoryId']) {
    if (req.body[field] !== undefined) {
      if (field === 'name' && (typeof req.body.name !== 'string' || !req.body.name.trim())) return res.status(400).json({ message: 'Product name is required.' });
      updates[field] = field === 'name' ? req.body[field].trim() : req.body[field];
    }
  }
  if (req.body.price !== undefined) {
    if (!Number.isFinite(Number(req.body.price)) || Number(req.body.price) < 0) return res.status(400).json({ message: 'Price must be a non-negative number.' });
    updates.price = Number(req.body.price);
  }
  if (updates.categoryId && !(await Category.exists({ _id: updates.categoryId }))) return res.status(400).json({ message: 'Choose an existing category.' });
  const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('categoryId', 'name');
  if (stockQuantity !== undefined) await Inventory.updateOne({ productId: product._id }, { $set: { quantity: stockQuantity } }, { upsert: true });
  res.json(product);
});

router.delete('/products/:id', requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid product id.' });
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json({ message: 'Product archived.' });
});

router.get('/cart', requireAuth, async (req, res) => res.json(await cartDetails(req.user.id)));

router.post('/cart', requireAuth, async (req, res) => {
  const { productId } = req.body;
  const quantity = Number(req.body.quantity || 1);
  if (!validId(productId) || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'Choose a valid product and quantity.' });
  const [product, inventory] = await Promise.all([
    Product.findOne({ _id: productId, isActive: true }),
    Inventory.findOne({ productId }),
  ]);
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  const cart = await Cart.findOneAndUpdate({ userId: req.user.id }, { $setOnInsert: { userId: req.user.id, items: [] } }, { upsert: true, new: true });
  const item = cart.items.find((entry) => entry.productId.toString() === productId);
  const requested = (item?.quantity || 0) + quantity;
  if (requested > (inventory?.quantity || 0)) return res.status(409).json({ message: 'There is not enough stock for that quantity.' });
  if (item) item.quantity = requested;
  else cart.items.push({ productId, quantity });
  await cart.save();
  res.json(await cartDetails(req.user.id));
});

router.patch('/cart/:productId', requireAuth, async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ message: 'Invalid product id.' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'Quantity must be a positive whole number.' });
  const [cart, inventory] = await Promise.all([
    Cart.findOne({ userId: req.user.id }),
    Inventory.findOne({ productId: req.params.productId }),
  ]);
  const item = cart?.items.find((entry) => entry.productId.toString() === req.params.productId);
  if (!cart || !item) return res.status(404).json({ message: 'Cart item not found.' });
  if (quantity > (inventory?.quantity || 0)) return res.status(409).json({ message: 'There is not enough stock for that quantity.' });
  item.quantity = quantity;
  await cart.save();
  res.json(await cartDetails(req.user.id));
});

router.delete('/cart/:productId', requireAuth, async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ message: 'Invalid product id.' });
  await Cart.updateOne({ userId: req.user.id }, { $pull: { items: { productId: req.params.productId } } });
  res.json(await cartDetails(req.user.id));
});

router.delete('/cart', requireAuth, async (req, res) => {
  await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
  res.json({ items: [], subtotal: 0, itemCount: 0 });
});

router.get('/inventory', requireAuth, requireAdmin, async (_req, res) => {
  res.json(await Inventory.find().populate({ path: 'productId', select: 'name image isActive' }).sort({ updatedAt: -1 }));
});

router.patch('/inventory/:productId', requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ message: 'Invalid product id.' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ message: 'Stock must be a non-negative whole number.' });
  const inventory = await Inventory.findOne({ productId: req.params.productId });
  if (!inventory) return res.status(404).json({ message: 'Inventory record not found.' });
  if (quantity < inventory.reservedQuantity) return res.status(409).json({ message: 'Stock cannot be lower than reserved inventory.' });
  inventory.quantity = quantity;
  await inventory.save();
  res.json(inventory);
});

router.get('/orders', requireAuth, async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(orders);
});

router.get('/orders/all', requireAuth, requireAdmin, async (_req, res) => {
  res.json(await Order.find().populate('userId', 'name email').sort({ createdAt: -1 }));
});

router.post('/orders', requireAuth, async (req, res) => {
  const address = req.body.shippingAddress || {};
  const required = ['name', 'email', 'address', 'city', 'postalCode'];
  if (required.some((key) => typeof address[key] !== 'string' || !address[key].trim())) {
    return res.status(400).json({ message: 'Complete all shipping details before placing your order.' });
  }
  const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
  if (!cart?.items.length) return res.status(400).json({ message: 'Your cart is empty.' });

  const orderItems = [];
  const inventoryUpdates = [];
  for (const item of cart.items) {
    const product = item.productId;
    if (!product?.isActive) return res.status(409).json({ message: 'A product in your cart is no longer available.' });
    const inventory = await Inventory.findOneAndUpdate(
      { productId: product._id, quantity: { $gte: item.quantity } },
      { $inc: { quantity: -item.quantity } },
      { new: true },
    );
    if (!inventory) {
      await Promise.all(inventoryUpdates.map(({ productId, quantity }) => Inventory.updateOne({ productId }, { $inc: { quantity } })));
      return res.status(409).json({ message: `${product.name} no longer has enough stock. Your cart is unchanged.` });
    }
    inventoryUpdates.push({ productId: product._id, quantity: item.quantity });
    orderItems.push({
      productId: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
    });
  }

  const originalCartItems = cart.items.map((item) => ({ productId: item.productId._id, quantity: item.quantity }));
  try {
    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    cart.items = [];
    await cart.save();
    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      totalAmount,
      shippingAddress: Object.fromEntries(required.map((key) => [key, address[key].trim()])),
      paymentMethod: 'mock',
      status: 'confirmed',
      paymentStatus: 'paid',
    });
    res.status(201).json(order);
  } catch (error) {
    cart.items = originalCartItems;
    await cart.save();
    await Promise.all(inventoryUpdates.map(({ productId, quantity }) => Inventory.updateOne({ productId }, { $inc: { quantity } })));
    throw error;
  }
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order id.' });
  const order = await Order.findById(req.params.id).populate('userId', 'name email');
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (req.user.role !== 'admin' && order.userId._id.toString() !== req.user.id) return res.status(403).json({ message: 'You cannot view this order.' });
  res.json(order);
});

router.patch('/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order id.' });
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid order status.' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (order.status === 'cancelled' && req.body.status !== 'cancelled') {
    return res.status(409).json({ message: 'Cancelled orders cannot be reopened.' });
  }
  if (req.body.status === 'cancelled' && ['shipped', 'delivered'].includes(order.status)) {
    return res.status(409).json({ message: 'Shipped or delivered orders cannot be cancelled.' });
  }
  if (order.status !== 'cancelled' && req.body.status === 'cancelled') {
    await Promise.all(order.items.map((item) => Inventory.updateOne({ productId: item.productId }, { $inc: { quantity: item.quantity } })));
    order.paymentStatus = order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus;
  }
  order.status = req.body.status;
  await order.save();
  res.json(order);
});

router.get('/admin/summary', requireAuth, requireAdmin, async (_req, res) => {
  const [products, orders, customers, inventory, revenue] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Inventory.find().populate('productId', 'name isActive'),
    Order.aggregate([{ $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
  ]);
  res.json({
    products,
    orders,
    customers,
    revenue: revenue[0]?.total || 0,
    lowStock: inventory.filter((item) => item.productId?.isActive && item.quantity < 5).length,
  });
});

export default router;
