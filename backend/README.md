# Northstar store API

Express and MongoDB API for the React storefront. The API seeds the starter catalog on first run and provisions an administrator from environment variables.

## Run locally

1. Start MongoDB locally, or create a MongoDB Atlas database.
2. In PowerShell, from this directory, create the local environment file:

   ```powershell
   Copy-Item config.example.env config.env
   ```

3. Edit `config.env` and set `mongodb_url`, a long random `JWT_SECRET`, and a private `ADMIN_EMAIL` / `ADMIN_PASSWORD`. `config.env` is ignored by Git.
4. Install dependencies and start the API:

   ```powershell
   npm install
   npm start
   ```

The API listens on `http://localhost:5000`. Check `http://localhost:5000/api/health` for its health endpoint. Startup stops with a clear error if MongoDB is missing or unreachable.

## Run the React app

In a second terminal, from `../frontend`:

```powershell
npm install
npm start
```

Open `http://localhost:3000`. The app calls this API by default. Set `REACT_APP_API_URL` before starting React if the API is hosted elsewhere, and set `FRONTEND_URL` in `config.env` to the exact frontend origin.

## Features

- Public product and category listing with search and filtering.
- Registration, login, JWT sessions, customer-only carts, and customer order history.
- Admin-only product/category creation, product archiving, stock management, sales summary, and order-status management.
- Checkout records an explicitly simulated `mock` payment as paid; it never requests or charges card details. Order placement checks and decrements inventory.

Register customer accounts in the storefront. The admin account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` when the server starts; changing those values does not promote an existing account.
