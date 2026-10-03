import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import apiRouter from './router/api.js';
import { seedStore } from './seed.js';

dotenv.config({ path: 'config.env' });

const app = express();
const port = Number(process.env.PORT || 5000);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', apiRouter);
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) return res.status(409).json({ message: 'That value is already in use.' });
  res.status(error.status || 500).json({ message: error.message || 'An unexpected server error occurred.' });
});

const mongoUrl = process.env.mongodb_url;
if (!mongoUrl) throw new Error('mongodb_url is missing from backend/config.env');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing from backend/config.env');
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/config.env to provision the store administrator.');
}

try {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');
  await seedStore();
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Could not start the API. Check mongodb_url and confirm MongoDB is reachable.', error);
  process.exitCode = 1;
}
