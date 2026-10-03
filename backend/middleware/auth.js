import jwt from 'jsonwebtoken';

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing from backend/config.env');
  return process.env.JWT_SECRET;
}

export function createToken(user) {
  return jwt.sign({ id: user._id.toString(), name: user.name, email: user.email, role: user.role }, secret(), { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch (error) {
    if (error.name === 'Error') return next(error);
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  next();
}
