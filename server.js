const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Keep admin routes ahead of the static-file middleware so /admin cannot be
// intercepted by the legacy public/admin.html redirect page.
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-login.html")));
app.get("/admin/", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-login.html")));
app.get("/admin/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-dashboard.html")));

app.use(express.static(path.join(__dirname, "public")));

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      products: [
        { id: "delta-basic", name: "DELTA Basic Key", price: 99, stock: 50, description: "Instant digital access key after admin verification.", badge: "POPULAR" },
        { id: "delta-pro", name: "DELTA Pro Key", price: 199, stock: 25, description: "Premium digital access key with priority verification.", badge: "PRO" },
        { id: "delta-ultra", name: "DELTA Ultra Key", price: 299, stock: 10, description: "Ultimate digital access key for advanced users.", badge: "ULTRA" }
      ],
      orders: [],
      keyPool: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}
ensureStore();

function readStore() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function publicOrder(order) {
  return {
    id: order.id,
    productId: order.productId,
    productName: order.productName,
    amount: order.amount,
    customerName: order.customerName,
    customerContact: order.customerContact,
    paymentReference: order.paymentReference,
    status: order.status,
    key: order.status === "approved" ? order.key : "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}
function adminAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return res.status(401).json({ error: "Admin login required." });
  let decoded = "";
  try { decoded = Buffer.from(auth.slice(6), "base64").toString("utf8"); } catch {}
  const split = decoded.indexOf(":");
  const user = split >= 0 ? decoded.slice(0, split) : "";
  const pass = split >= 0 ? decoded.slice(split + 1) : "";
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "change-this-password";
  if (user !== expectedUser || pass !== expectedPass) {
    return res.status(401).json({ error: "Invalid admin username or password." });
  }
  next();
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/products", (req, res) => res.sendFile(path.join(__dirname, "public", "products.html")));
app.get("/payment", (req, res) => res.sendFile(path.join(__dirname, "public", "payment.html")));
app.get("/status", (req, res) => res.sendFile(path.join(__dirname, "public", "status.html")));

app.get("/api/health", (req, res) => res.json({ ok: true, app: "DELTA.KEYS", paymentMode: "manual-admin-approval" }));
app.get("/api/products", (req, res) => res.json(readStore().products));

app.get("/api/payment-info", (req, res) => {
  res.json({
    upiId: process.env.PAYMENT_UPI_ID || "8590887093@fam",
    payeeName: process.env.PAYMENT_PAYEE_NAME || "DELTA.KEYS",
    note: process.env.PAYMENT_NOTE || "DELTA.KEYS order payment"
  });
});

app.post("/api/orders", (req, res) => {
  const { productId } = req.body || {};
  const store = readStore();
  const product = store.products.find(p => p.id === productId);

  if (!product) return res.status(400).json({ error: "Product not found." });
  if (Number(product.stock || 0) < 1) return res.status(400).json({ error: "This product is out of stock." });
  const now = new Date().toISOString();
  const order = {
    id: "DK-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    productId: product.id,
    productName: product.name,
    amount: product.price,
    customerName: "Guest customer",
    customerContact: "Not provided",
    paymentReference: "Pending manual verification",
    status: "pending",
    key: "",
    createdAt: now,
    updatedAt: now
  };

  store.orders.unshift(order);
  product.stock = Math.max(0, Number(product.stock || 0) - 1);
  writeStore(store);
  res.status(201).json({ order: publicOrder(order) });
});

app.get("/api/orders/:id", (req, res) => {
  const order = readStore().orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json({ order: publicOrder(order) });
});

app.get("/api/admin/data", adminAuth, (req, res) => {
  const store = readStore();
  res.json({
    products: store.products,
    orders: store.orders.map(o => ({ ...o })),
    keyPoolCount: (store.keyPool || []).length
  });
});

app.put("/api/admin/orders/:id", adminAuth, (req, res) => {
  const store = readStore();
  const order = store.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const { status, key, customerName, customerContact } = req.body || {};
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  if (typeof key === "string") order.key = key.trim();
  if (typeof customerName === "string") order.customerName = customerName.trim();
  if (typeof customerContact === "string") order.customerContact = customerContact.trim();

  if (status) {
    if (status === "approved" && !String(order.key || "").trim()) {
      const pool = Array.isArray(store.keyPool) ? store.keyPool : [];
      if (!pool.length) return res.status(400).json({ error: "Upload a key in the admin key pool before approving." });
      order.key = pool.shift();
      store.keyPool = pool;
    }
    order.status = status;
  }
  order.updatedAt = new Date().toISOString();
  writeStore(store);
  res.json({ order: publicOrder(order) });
});

app.post("/api/admin/keys", adminAuth, (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys : String(req.body?.keys || "").split(/\r?\n/);
  const clean = keys.map(k => String(k).trim()).filter(Boolean);
  const store = readStore();
  store.keyPool = Array.isArray(store.keyPool) ? store.keyPool : [];
  store.keyPool.push(...clean);
  writeStore(store);
  res.json({ added: clean.length, total: store.keyPool.length });
});

app.put("/api/admin/products/:id", adminAuth, (req, res) => {
  const store = readStore();
  const product = store.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  const { name, price, stock, description, badge } = req.body || {};
  if (typeof name === "string" && name.trim()) product.name = name.trim();
  if (Number.isFinite(Number(price)) && Number(price) >= 0) product.price = Number(price);
  if (Number.isFinite(Number(stock)) && Number(stock) >= 0) product.stock = Math.floor(Number(stock));
  if (typeof description === "string") product.description = description.trim();
  if (typeof badge === "string") product.badge = badge.trim();
  writeStore(store);
  res.json({ product });
});

app.post("/api/admin/products", adminAuth, (req, res) => {
  const store = readStore();
  const { name, price, stock, description, badge } = req.body || {};
  if (!String(name || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: "Product name and valid price are required." });
  }
  const product = {
    id: "product-" + crypto.randomBytes(5).toString("hex"),
    name: String(name).trim(), price: Number(price), stock: Math.max(0, Math.floor(Number(stock || 0))),
    description: String(description || "").trim(), badge: String(badge || "NEW").trim()
  };
  store.products.push(product); writeStore(store); res.status(201).json({ product });
});

app.delete("/api/admin/products/:id", adminAuth, (req, res) => {
  const store = readStore();
  const before = store.products.length;
  store.products = store.products.filter(p => p.id !== req.params.id);
  if (before === store.products.length) return res.status(404).json({ error: "Product not found." });
  writeStore(store); res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DELTA.KEYS running on port ${PORT} — manual admin approval mode`);
});
