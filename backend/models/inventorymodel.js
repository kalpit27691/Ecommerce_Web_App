import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  reservedQuantity: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
