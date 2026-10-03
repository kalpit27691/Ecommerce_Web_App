# Northstar Store

A full-stack ecommerce demo with a React storefront and an Express/MongoDB API.

## Run locally

1. Start MongoDB.
2. Configure `backend/config.env` from [`backend/config.example.env`](backend/config.example.env). Use a private, strong `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. In one terminal, start the API:

   ```powershell
   cd backend
   npm install
   npm start
   ```

4. In another terminal, start the storefront:

   ```powershell
   cd frontend
   npm install
   npm start
   ```

5. Open `http://localhost:3000`. The API listens on `http://localhost:5000`.

## Included

- Product listing, search, categories, product detail, cart, checkout, and customer order history.
- JWT authentication and customer/admin roles.
- Admin dashboard with sales summary, product/category management, inventory, and order-status management.
- Mock checkout only: the demo creates no real payment or card charge.

See [`backend/README.md`](backend/README.md) for database/API setup and [`frontend/README.md`](frontend/README.md) for frontend commands.
