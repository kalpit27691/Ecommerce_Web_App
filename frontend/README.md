# Northstar storefront

React storefront connected to the Express/MongoDB API in `../backend`.

## Start the full app

Start MongoDB, configure `backend/config.env` using `backend/config.example.env`, and start the backend first:

```powershell
Set-Location ..\backend
Copy-Item config.example.env config.env
# Edit config.env with your MongoDB URL and private admin/JWT credentials.
npm install
npm start
```

In a second PowerShell terminal:

```powershell
Set-Location ..\frontend
npm install
npm start
```

Open `http://localhost:3000`. The storefront uses `http://localhost:5000/api` by default. Set `REACT_APP_API_URL` before starting the frontend to use a different API URL.

## Store features

- Product browsing, category filters, search, sorting, and product details.
- Account registration/sign-in, persistent cart, inventory-aware quantities, and shipping checkout.
- Mock payment confirmation (no card data or real charge), customer order history, and order statuses.
- Admin dashboard for sales/order overview, products/categories, inventory, and order status updates.

See [`../backend/README.md`](../backend/README.md) for API setup, database configuration, and admin provisioning.

## Available scripts

- `npm start` runs the React development server.
- `npm test -- --watchAll=false` runs the storefront test.
- `npm run build` creates the production build.
