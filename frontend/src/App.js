import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api/api';
import './App.css';

const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount || 0);
const imageFallback = 'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=80';

function Icon({ name, size = 20 }) {
  const shared = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bag: <><path d="M4 8h16l-1 13H5L4 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function ProductCard({ product, onOpen, onAdd }) {
  const category = product.categoryId?.name || 'Objects';
  return (
    <article className="product-card">
      <button className="product-image-button" onClick={() => onOpen(product)} aria-label={`View ${product.name}`}>
        <img src={product.image || imageFallback} alt={product.name} onError={(event) => { event.currentTarget.src = imageFallback; }} />
        <span className="image-tag">{product.stock > 0 ? 'In stock' : 'Sold out'}</span>
      </button>
      <div className="product-info">
        <div>
          <span className="product-category">{category}</span>
          <button className="product-name" onClick={() => onOpen(product)}>{product.name}</button>
        </div>
        <span className="product-price">{money(product.price)}</span>
      </div>
      <button className="quick-add" disabled={!product.stock} onClick={() => onAdd(product)}>
        {product.stock ? <><Icon name="plus" size={16} /> Add to bag</> : 'Sold out'}
      </button>
    </article>
  );
}

function AuthDialog({ onClose, onAuthenticated, notify }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onAuthenticated(result);
      notify(`Welcome${result.user.name ? `, ${result.user.name.split(' ')[0]}` : ' back'}!`);
      onClose();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <div className="eyebrow">YOUR NORTHSTAR ACCOUNT</div>
        <h2 id="auth-title">{mode === 'login' ? 'Good to see you.' : 'Make yourself at home.'}</h2>
        <p className="muted">{mode === 'login' ? 'Sign in to pick up where you left off.' : 'A few details and you’re in.'}</p>
        <form onSubmit={submit} className="form-stack">
          {mode === 'register' && <label>Your name<input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
          <label>Email address<input autoComplete="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength="8" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <button className="button button-dark button-wide" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'} <Icon name="arrow" size={17} /></button>
        </form>
        <p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
      </section>
    </div>
  );
}

function AdminDashboard({ token, products, categories, onRefresh, notify }) {
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', categoryId: '', image: '', stock: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      const [nextSummary, nextOrders, nextInventory] = await Promise.all([
        api('/admin/summary', { token }),
        api('/orders/all', { token }),
        api('/inventory', { token }),
      ]);
      setSummary(nextSummary);
      setOrders(nextOrders);
      setInventory(nextInventory);
    } catch (error) {
      notify(error.message, 'error');
    }
  }, [token, notify]);

  useEffect(() => { loadAdminData(); }, [loadAdminData]);

  async function updateStatus(id, status) {
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ status }) });
      await loadAdminData();
      notify('Order status updated.');
    } catch (error) { notify(error.message, 'error'); }
  }

  async function updateStock(productId, quantity) {
    try {
      await api(`/inventory/${productId}`, { method: 'PATCH', token, body: JSON.stringify({ quantity: Number(quantity) }) });
      await Promise.all([loadAdminData(), onRefresh()]);
      notify('Inventory updated.');
    } catch (error) { notify(error.message, 'error'); }
  }

  async function createProduct(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/products', { method: 'POST', token, body: JSON.stringify({ ...productForm, price: Number(productForm.price), stock: Number(productForm.stock) }) });
      setProductForm({ name: '', description: '', price: '', categoryId: '', image: '', stock: '' });
      await Promise.all([onRefresh(), loadAdminData()]);
      notify('Product added to your store.');
    } catch (error) { notify(error.message, 'error'); }
    finally { setSaving(false); }
  }

  async function createCategory(event) {
    event.preventDefault();
    try {
      await api('/categories', { method: 'POST', token, body: JSON.stringify(categoryForm) });
      setCategoryForm({ name: '', description: '' });
      await onRefresh();
      notify('Category created.');
    } catch (error) { notify(error.message, 'error'); }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Archive ${product.name}? It will no longer appear in the shop.`)) return;
    try {
      await api(`/products/${product._id}`, { method: 'DELETE', token });
      await Promise.all([onRefresh(), loadAdminData()]);
      notify('Product archived.');
    } catch (error) { notify(error.message, 'error'); }
  }

  const tabs = [['overview', 'Overview'], ['products', 'Products'], ['inventory', 'Inventory'], ['orders', 'Orders']];
  return (
    <main className="admin-page content-width">
      <div className="admin-heading">
        <div><span className="eyebrow">NORTHSTAR / CONTROL ROOM</span><h1>Store dashboard</h1><p className="muted">A clear view of how things are moving.</p></div>
        <span className="admin-pill">Administrator</span>
      </div>
      <nav className="admin-tabs" aria-label="Dashboard sections">{tabs.map(([key, label]) => <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>{label}</button>)}</nav>

      {tab === 'overview' && <section className="admin-section">
        <div className="metric-grid">
          {[['Gross sales', money(summary?.revenue), 'Paid orders, less cancellations'], ['Orders', summary?.orders ?? '—', 'Across all customers'], ['Products', summary?.products ?? '—', 'Active in your shop'], ['Low stock', summary?.lowStock ?? '—', 'Fewer than five left']].map(([label, value, caption]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{caption}</small></article>)}
        </div>
        <div className="admin-panel"><div className="panel-heading"><div><h2>Latest orders</h2><p className="muted">The newest things headed out into the world.</p></div><button className="text-link" onClick={() => setTab('orders')}>All orders <Icon name="arrow" size={15} /></button></div><OrderTable orders={orders.slice(0, 5)} onStatus={updateStatus} compact /></div>
      </section>}

      {tab === 'products' && <section className="admin-section admin-columns">
        <div className="admin-panel"><div className="panel-heading"><div><h2>Your products</h2><p className="muted">{products.length} active products</p></div></div><div className="admin-product-list">{products.map((product) => <div className="admin-product" key={product._id}><img src={product.image || imageFallback} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)} · {product.categoryId?.name}</span></div><button className="text-link danger-link" onClick={() => archiveProduct(product)}>Archive</button></div>)}</div></div>
        <div className="admin-panel"><h2>Add a product</h2><form className="form-stack admin-form" onSubmit={createProduct}><label>Product name<input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label><label>Description<textarea rows="3" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label><div className="form-row"><label>Price<input type="number" min="0" step="0.01" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></label><label>Starting stock<input type="number" min="0" step="1" required value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} /></label></div><label>Category<select required value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}><option value="">Choose a category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label>Image URL<input type="url" placeholder="https://" value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} /></label><button className="button button-dark" disabled={saving}>{saving ? 'Adding…' : 'Add product'} <Icon name="arrow" size={16} /></button></form>
          <div className="category-create"><h3>Add a category</h3><form className="form-stack admin-form" onSubmit={createCategory}><label>Name<input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /></label><label>Short description<input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /></label><button className="button button-light">Create category</button></form></div>
        </div>
      </section>}

      {tab === 'inventory' && <section className="admin-panel admin-section"><div className="panel-heading"><div><h2>Inventory</h2><p className="muted">Stock updates take effect in the shop right away.</p></div></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>Available</th><th>Reserved</th><th>Update stock</th></tr></thead><tbody>{inventory.filter((item) => item.productId?.isActive).map((item) => <tr key={item._id}><td>{item.productId?.name}</td><td><span className={item.quantity < 5 ? 'stock-low' : ''}>{item.quantity}</span></td><td>{item.reservedQuantity}</td><td><form className="stock-form" onSubmit={(e) => { e.preventDefault(); updateStock(item.productId._id, e.currentTarget.quantity.value); }}><input aria-label={`New stock for ${item.productId?.name}`} name="quantity" type="number" min={item.reservedQuantity} defaultValue={item.quantity} /><button className="button button-light">Save</button></form></td></tr>)}</tbody></table></div></section>}

      {tab === 'orders' && <section className="admin-panel admin-section"><div className="panel-heading"><div><h2>All orders</h2><p className="muted">Update each order as it moves from your studio to their door.</p></div></div><OrderTable orders={orders} onStatus={updateStatus} /></section>}
    </main>
  );
}

function OrderTable({ orders, onStatus, compact = false }) {
  if (!orders.length) return <div className="empty-inline">No orders yet. They’ll show up here as soon as they’re placed.</div>;
  return <div className="table-scroll"><table><thead><tr><th>Order</th>{!compact && <th>Customer</th>}<th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td><strong>#{order._id.slice(-7).toUpperCase()}</strong><small className="table-sub">{order.items.length} items</small></td>{!compact && <td>{order.userId?.name || order.shippingAddress?.name || 'Customer'}<small className="table-sub">{order.userId?.email || order.shippingAddress?.email}</small></td>}<td>{new Date(order.createdAt).toLocaleDateString()}</td><td>{money(order.totalAmount)}</td><td><select className={`status-select status-${order.status}`} value={order.status} onChange={(event) => onStatus(order._id, event.target.value)} aria-label={`Status for order ${order._id.slice(-7)}`}>{['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>;
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState({ items: [], subtotal: 0, itemCount: 0 });
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('northstar-token') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState('shop');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [toast, setToast] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', address: '', city: '', postalCode: '' });
  const [orders, setOrders] = useState([]);
  const [orderBusy, setOrderBusy] = useState(false);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const refreshCatalog = useCallback(async () => {
    const [nextProducts, nextCategories] = await Promise.all([api('/products'), api('/categories')]);
    setProducts(nextProducts);
    setCategories(nextCategories);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api('/products'), api('/categories')])
      .then(([nextProducts, nextCategories]) => {
        if (!active) return;
        setProducts(nextProducts);
        setCategories(nextCategories);
        setError('');
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setCart({ items: [], subtotal: 0, itemCount: 0 });
      return;
    }
    let active = true;
    Promise.all([api('/auth/me', { token }), api('/cart', { token })])
      .then(([account, nextCart]) => {
        if (!active) return;
        setUser(account.user);
        setCart(nextCart);
      })
      .catch(() => {
        localStorage.removeItem('northstar-token');
        if (active) {
          setToken('');
          setUser(null);
          setCart({ items: [], subtotal: 0, itemCount: 0 });
        }
      });
    return () => { active = false; };
  }, [token]);

  const visibleProducts = useMemo(() => {
    let result = products.filter((product) => categoryFilter === 'all' || product.categoryId?._id === categoryFilter);
    if (search.trim()) result = result.filter((product) => `${product.name} ${product.description} ${product.categoryId?.name}`.toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === 'price-low') result = [...result].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') result = [...result].sort((a, b) => b.price - a.price);
    if (sort === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, categoryFilter, search, sort]);

  function authenticated(result) {
    localStorage.setItem('northstar-token', result.token);
    setToken(result.token);
    setUser(result.user);
  }

  function signOut() {
    localStorage.removeItem('northstar-token');
    setToken('');
    setUser(null);
    setCart({ items: [], subtotal: 0, itemCount: 0 });
    setPage('shop');
    notify('You’ve signed out.');
  }

  async function addToCart(product) {
    if (!user) {
      setAuthOpen(true);
      notify('Sign in to add something to your bag.', 'error');
      return;
    }
    try {
      const updated = await api('/cart', { method: 'POST', token, body: JSON.stringify({ productId: product._id, quantity: 1 }) });
      setCart(updated);
      setDetail(null);
      notify(`${product.name} added to your bag.`);
    } catch (requestError) { notify(requestError.message, 'error'); }
  }

  async function updateQuantity(productId, quantity) {
    try {
      const updated = await api(`/cart/${productId}`, { method: 'PATCH', token, body: JSON.stringify({ quantity }) });
      setCart(updated);
    } catch (requestError) { notify(requestError.message, 'error'); }
  }

  async function removeFromCart(productId) {
    try {
      setCart(await api(`/cart/${productId}`, { method: 'DELETE', token }));
      notify('Removed from your bag.');
    } catch (requestError) { notify(requestError.message, 'error'); }
  }

  async function openOrders() {
    if (!user) { setAuthOpen(true); return; }
    try {
      setOrders(await api('/orders', { token }));
      setPage('orders');
    } catch (requestError) { notify(requestError.message, 'error'); }
  }

  async function placeOrder(event) {
    event.preventDefault();
    setOrderBusy(true);
    try {
      const order = await api('/orders', { method: 'POST', token, body: JSON.stringify({ shippingAddress: checkoutForm, paymentMethod: 'mock' }) });
      setCart({ items: [], subtotal: 0, itemCount: 0 });
      setOrders([order, ...orders]);
      setPage('orders');
      notify('Payment approved — your order is confirmed.');
    } catch (requestError) { notify(requestError.message, 'error'); }
    finally { setOrderBusy(false); }
  }

  function goToCheckout() {
    if (!user) {
      setCartOpen(false);
      setAuthOpen(true);
      return;
    }
    setCheckoutForm((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }));
    setCartOpen(false);
    setPage('checkout');
  }

  return (
    <div className="app-shell">
      <div className="announcement"><span>Considered things for everyday living</span><span className="announcement-note">Complimentary shipping on orders over $100 <span aria-hidden="true">↗</span></span></div>
      <header className="site-header">
        <button className="brand" onClick={() => { setPage('shop'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Northstar home"><span className="brand-mark">N.</span><span className="brand-word">NORTHSTAR<span>OBJECTS FOR LIVING</span></span></button>
        <nav className="main-nav"><button className={page === 'shop' ? 'nav-current' : ''} onClick={() => setPage('shop')}>Shop all</button><button onClick={() => { setCategoryFilter('all'); setPage('shop'); document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' }); }}>Our collection</button><button onClick={openOrders}>Orders</button>{user?.role === 'admin' && <button onClick={() => setPage('admin')}>Dashboard</button>}</nav>
        <div className="header-actions">
          <label className="header-search"><Icon name="search" size={18} /><input aria-label="Search products" placeholder="Search" value={search} onChange={(event) => { setSearch(event.target.value); setPage('shop'); }} /><kbd>/</kbd></label>
          {user ? <button className="account-button" onClick={signOut} title="Sign out"><span className="avatar">{user.name?.[0]?.toUpperCase()}</span><span className="account-name">{user.name.split(' ')[0]}</span><Icon name="logout" size={17} /></button> : <button className="icon-button account-trigger" onClick={() => setAuthOpen(true)} aria-label="Sign in"><Icon name="user" /></button>}
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Shopping bag, ${cart.itemCount} items`}><Icon name="bag" /><span>Bag</span><span className="bag-count">{cart.itemCount}</span></button>
        </div>
      </header>

      {page === 'shop' && <>
        <main>
          <section className="hero content-width">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE MORE INTENTIONAL</div>
              <h1>Good things,<br /><em>well chosen.</em></h1>
              <p>Everyday pieces with a point of view. Thoughtfully made, a pleasure to live with, and here to stay.</p>
              <button className="button button-dark" onClick={() => document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' })}>Explore the collection <Icon name="arrow" size={17} /></button>
              <div className="hero-note"><span>01 — 08</span><span>OBJECTS WITH A PURPOSE</span></div>
            </div>
            <div className="hero-visual"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1500&q=90" alt="Quiet, sunlit living room with carefully chosen objects" /><div className="hero-image-caption"><span>Made for the everyday.</span><span>EST. 2024&nbsp; · &nbsp;EVERYWHERE</span></div><div className="hero-stamp">LIVE<br />WITH<br />LESS,<br /><i>better.</i></div></div>
          </section>
          <div className="promise-strip"><span>◌ &nbsp; Made to be lived with</span><span>✳ &nbsp; Small-batch, big intention</span><span>↗ &nbsp; Shipping that’s on us over $100</span></div>
          <section className="collection-section content-width" id="shop-grid">
            <div className="collection-intro"><div><div className="eyebrow">THE GOOD STUFF</div><h2>Objects for <em>every day.</em></h2></div><p>Less, but more considered. Meet the pieces earning their place in your home, one thoughtful detail at a time.</p></div>
            <div className="collection-toolbar">
              <div className="category-filters"><button className={categoryFilter === 'all' ? 'selected' : ''} onClick={() => setCategoryFilter('all')}>Everything <span>{products.length}</span></button>{categories.map((category) => <button className={categoryFilter === category._id ? 'selected' : ''} onClick={() => setCategoryFilter(category._id)} key={category._id}>{category.name}</button>)}</div>
              <label className="sort-control"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label>
            </div>
            {error && <div className="api-error"><strong>We can’t reach the store just yet.</strong><span>{error}</span><button className="text-link" onClick={() => window.location.reload()}>Try again <Icon name="arrow" size={15} /></button></div>}
            {loading ? <div className="loading-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item}><div /><span /><span /></div>)}</div> : visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product._id} product={product} onOpen={setDetail} onAdd={addToCart} />)}</div> : <div className="empty-state"><span>✳</span><h3>Nothing on this shelf.</h3><p>Try a different search or category.</p><button className="text-link" onClick={() => { setSearch(''); setCategoryFilter('all'); }}>Clear filters <Icon name="arrow" size={15} /></button></div>}
            <div className="collection-foot"><span>SHOWING {visibleProducts.length} OF {products.length} OBJECTS</span><span>THOUGHTFULLY SOURCED · NEVER JUST MORE</span></div>
          </section>
          <section className="story-band"><div className="story-photo"><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85" alt="Warm, natural materials in a calm home" /></div><div className="story-copy"><span className="eyebrow">A NOTE ON NORTHSTAR</span><h2>Buy fewer things.<br /><em>Love them longer.</em></h2><p>We think a good home isn’t built in a day, and it certainly isn’t built in a shopping cart. We find the useful, the lasting, and the quietly lovely—then let you take it from there.</p><button className="text-link" onClick={() => notify('A little more about us, coming soon.')}>Our point of view <Icon name="arrow" size={16} /></button><span className="story-signature">A good place to begin. &nbsp;— N.</span></div></section>
        </main>
        <footer className="site-footer"><div className="footer-top"><div><button className="brand footer-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="brand-mark">N.</span><span className="brand-word">NORTHSTAR<span>OBJECTS FOR LIVING</span></span></button><p>Good things, well chosen.<br />And meant to be kept.</p></div><div className="footer-links"><button onClick={() => setPage('shop')}>Shop the collection</button><button onClick={openOrders}>Your orders</button><button onClick={() => setCartOpen(true)}>Your bag ({cart.itemCount})</button></div><div className="footer-message"><span className="eyebrow">A SMALL NOTE FROM US</span><p>Thoughtful things, occasional notes. No noise.</p><button className="text-link" onClick={() => notify('Newsletter sign-up is coming soon.')}>Stay in the loop <Icon name="arrow" size={15} /></button></div></div><div className="footer-bottom"><span>© 2026 NORTHSTAR OBJECTS</span><span>MADE FOR THE WAY WE LIVE NOW.</span><button onClick={() => notify('Payment is simulated for this demo store.')}>SECURE MOCK CHECKOUT</button></div></footer>
      </>}

      {page === 'checkout' && <main className="content-width inner-page"><button className="back-link" onClick={() => setPage('shop')}>← &nbsp;Back to shop</button><div className="checkout-layout"><section><span className="eyebrow">ALMOST YOURS</span><h1>Make it <em>official.</em></h1><p className="muted">A few details and this good thing is on its way.</p><form onSubmit={placeOrder} className="form-stack checkout-form"><h2>Shipping details</h2><div className="form-row"><label>Full name<input autoComplete="name" required value={checkoutForm.name} onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })} /></label><label>Email<input autoComplete="email" type="email" required value={checkoutForm.email} onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })} /></label></div><label>Street address<input autoComplete="street-address" required value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} /></label><div className="form-row"><label>City<input autoComplete="address-level2" required value={checkoutForm.city} onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })} /></label><label>Postal code<input autoComplete="postal-code" required value={checkoutForm.postalCode} onChange={(e) => setCheckoutForm({ ...checkoutForm, postalCode: e.target.value })} /></label></div><div className="payment-note"><span className="payment-dot"><Icon name="check" size={15} /></span><div><strong>Demo payment · no card needed</strong><p>This connected demo approves the payment automatically. No real charge is made.</p></div><span className="mock-badge">MOCK</span></div><button disabled={!cart.items.length || orderBusy} className="button button-dark button-wide place-order">{orderBusy ? 'Placing your order…' : `Place order · ${money(cart.subtotal)}`} <Icon name="arrow" size={17} /></button></form></section><aside className="checkout-summary"><h2>Your bag <span>({cart.itemCount})</span></h2>{cart.items.map(({ product, quantity, subtotal }) => <div className="checkout-item" key={product._id}><img src={product.image || imageFallback} alt="" /><div><strong>{product.name}</strong><span>Qty {quantity}</span></div><span>{money(subtotal)}</span></div>)}<div className="summary-line"><span>Subtotal</span><span>{money(cart.subtotal)}</span></div><div className="summary-line"><span>Shipping</span><span>{cart.subtotal >= 100 ? 'On us' : 'Complimentary'}</span></div><div className="summary-total"><span>Total</span><strong>{money(cart.subtotal)}</strong></div><p className="muted tax-note">Taxes included. Mock payment only.</p></aside></div></main>}

      {page === 'orders' && <main className="content-width inner-page orders-page"><span className="eyebrow">A GOOD THING, ON ITS WAY</span><h1>Your <em>orders.</em></h1><p className="muted">Everything you’ve brought home from Northstar.</p>{orders.length ? <div className="customer-orders">{orders.map((order) => <article className="customer-order" key={order._id}><div className="customer-order-heading"><div><span className="eyebrow">ORDER #{order._id.slice(-7).toUpperCase()}</span><span className="muted">{new Date(order.createdAt).toLocaleDateString()}</span></div><span className={`order-status status-${order.status}`}>{order.status}</span></div><div className="customer-order-items">{order.items.map((item) => <div className="checkout-item" key={item.productId}><img src={item.image || imageFallback} alt="" /><div><strong>{item.name}</strong><span>Quantity {item.quantity}</span></div><span>{money(item.subtotal)}</span></div>)}</div><div className="customer-order-bottom"><span>Payment · {order.paymentStatus} <span className="mock-badge">MOCK</span></span><strong>{money(order.totalAmount)}</strong></div></article>)}</div> : <div className="empty-state orders-empty"><span>◌</span><h3>No orders just yet.</h3><p>Your next favorite thing is out there.</p><button className="button button-dark" onClick={() => setPage('shop')}>Find it here <Icon name="arrow" size={16} /></button></div>}</main>}

      {page === 'admin' && user?.role === 'admin' && <AdminDashboard token={token} products={products} categories={categories} onRefresh={refreshCatalog} notify={notify} />}
      {page === 'admin' && user?.role !== 'admin' && <main className="content-width inner-page"><h1>That space is <em>reserved.</em></h1><p className="muted">Administrator access is required.</p><button className="button button-dark" onClick={() => setPage('shop')}>Back to the shop <Icon name="arrow" size={16} /></button></main>}

      {detail && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title"><button className="icon-button modal-close" onClick={() => setDetail(null)} aria-label="Close"><Icon name="close" /></button><div className="detail-image"><img src={detail.image || imageFallback} alt={detail.name} onError={(event) => { event.currentTarget.src = imageFallback; }} /></div><div className="detail-copy"><span className="eyebrow">{detail.categoryId?.name || 'NORTHSTAR OBJECTS'}</span><h2 id="product-title">{detail.name}</h2><strong className="detail-price">{money(detail.price)}</strong><p>{detail.description}</p><div className="detail-stock"><span className={detail.stock < 5 ? 'stock-low' : ''}>{detail.stock > 0 ? `${detail.stock} in stock` : 'Currently sold out'}</span><span>Thoughtfully made · Designed to last</span></div><button className="button button-dark button-wide" disabled={!detail.stock} onClick={() => addToCart(detail)}>{detail.stock ? 'Add to your bag' : 'Sold out'} <Icon name="arrow" size={17} /></button><div className="detail-promise">↗ &nbsp; Complimentary shipping on every order</div></div></section></div>}

      {cartOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="cart-drawer" aria-label="Shopping bag"><div className="drawer-heading"><div><span className="eyebrow">THE GOOD STUFF</span><h2>Your bag <span>({cart.itemCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><Icon name="close" /></button></div>{cart.items.length ? <><div className="drawer-items">{cart.items.map(({ product, quantity, subtotal, stock }) => <article className="cart-item" key={product._id}><img src={product.image || imageFallback} alt={product.name} /><div className="cart-item-info"><span className="eyebrow">{product.categoryId?.name || 'NORTHSTAR'}</span><strong>{product.name}</strong><span>{money(product.price)}</span><div className="quantity-control"><button onClick={() => quantity <= 1 ? removeFromCart(product._id) : updateQuantity(product._id, quantity - 1)} aria-label={`Decrease ${product.name} quantity`}>{quantity <= 1 ? <Icon name="close" size={14} /> : <Icon name="minus" size={14} />}</button><span>{quantity}</span><button disabled={quantity >= stock} onClick={() => updateQuantity(product._id, quantity + 1)} aria-label={`Increase ${product.name} quantity`}><Icon name="plus" size={14} /></button></div></div><strong className="cart-item-price">{money(subtotal)}</strong></article>)}</div><div className="drawer-bottom"><div className="shipping-progress"><span>✳</span><p>{cart.subtotal >= 100 ? 'You’ve unlocked complimentary shipping.' : `Add ${money(100 - cart.subtotal)} more for complimentary shipping.`}</p></div><div className="summary-line"><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><p className="drawer-tax-note">Shipping and taxes calculated at checkout.</p><button className="button button-dark button-wide" onClick={goToCheckout}>Continue to checkout <Icon name="arrow" size={17} /></button></div></> : <div className="drawer-empty"><span className="empty-bag-icon"><Icon name="bag" size={27} /></span><h3>A little room for good things.</h3><p>Your bag is empty for now.</p><button className="button button-dark" onClick={() => { setCartOpen(false); setPage('shop'); }}>Find something lovely <Icon name="arrow" size={16} /></button></div>}</aside></div>}

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuthenticated={authenticated} notify={notify} />}
      {toast && <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === 'error' ? '!' : <Icon name="check" size={16} />}</span>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={15} /></button></div>}
    </div>
  );
}
