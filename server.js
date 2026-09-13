const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

app.use(express.json({ limit: "1mb", verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); } }));
app.use(express.urlencoded({ extended: true }));

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-login.html")));
app.get("/admin/", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-login.html")));
app.get("/admin/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-dashboard.html")));
app.get("/admin-login", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-login.html")));
app.get("/admin-login.html", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-login.html")));
app.get("/admin/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "public", "admin-dashboard.html")));
app.use(express.static(path.join(__dirname, "public")));

function defaultPlans() {
  return [
    { id: "5-hours", name: "5 Hours", durationHours: 5, price: 49, active: true },
    { id: "1-day", name: "1 Day", durationHours: 24, price: 79, active: true },
    { id: "7-days", name: "7 Days", durationHours: 168, price: 149, active: true },
    { id: "30-days", name: "30 Days", durationHours: 720, price: 299, active: true },
    { id: "lifetime", name: "Lifetime", durationHours: 0, price: 499, active: true }
  ];
}

function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyAdminPassword(password, stored) {
  try {
    const [salt, expectedHex] = String(stored || "").split(":");
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      products: [
        { id: "delta-basic", name: "DELTA Basic Key", price: 99, stock: 50, description: "Digital access key.", badge: "POPULAR", plans: defaultPlans() },
        { id: "delta-pro", name: "DELTA Pro Key", price: 199, stock: 25, description: "Premium digital access key.", badge: "PRO", plans: defaultPlans() },
        { id: "delta-ultra", name: "DELTA Ultra Key", price: 299, stock: 10, description: "Ultimate digital access key.", badge: "ULTRA", plans: defaultPlans() }
      ],
      orders: [],
      keyPool: [],
      paymentSettings: { upiId: process.env.UPI_ID || "", payeeName: process.env.PAYMENT_PAYEE_NAME || "DELTA.KEYS" },
      sidebarOrder: ["dashboard","orders","products","keys","durations","settings","telegram"],
      adminCredentials: { username: process.env.ADMIN_USER || "admin", passwordHash: hashAdminPassword(process.env.ADMIN_PASSWORD || "change-this-password") }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}
ensureStore();

function readStore() {
  const store = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  for (const p of store.products || []) {
    if (!Array.isArray(p.plans) || !p.plans.length) {
      p.plans = [{ id: "default", name: "Default", durationHours: 0, price: Number(p.price || 0), active: true }];
    }
  }
  if (!Array.isArray(store.keyPool)) store.keyPool = [];
  if (!store.paymentSettings || typeof store.paymentSettings !== "object") store.paymentSettings = {};
  if (typeof store.paymentSettings.upiId !== "string") store.paymentSettings.upiId = process.env.UPI_ID || "";
  if (typeof store.paymentSettings.payeeName !== "string" || !store.paymentSettings.payeeName.trim()) store.paymentSettings.payeeName = process.env.PAYMENT_PAYEE_NAME || "DELTA.KEYS";
  if (!Array.isArray(store.sidebarOrder)) store.sidebarOrder = ["dashboard","orders","products","keys","durations","settings","telegram"];
  if (!store.adminCredentials || typeof store.adminCredentials !== "object" || !store.adminCredentials.passwordHash) {
    store.adminCredentials = { username: process.env.ADMIN_USER || "admin", passwordHash: hashAdminPassword(process.env.ADMIN_PASSWORD || "change-this-password") };
    writeStore(store);
  }
  return store;
}
function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function findPlan(product, planId) {
  return (product.plans || []).find(x => x.id === planId && x.active !== false);
}
function publicProduct(p) {
  return { ...p, plans: (p.plans || []).filter(x => x.active !== false) };
}
function publicOrder(order) {
  return {
    id: order.id, productId: order.productId, productName: order.productName,
    planId: order.planId, duration: order.duration, amount: order.amount,
    paymentReference: order.paymentReference || "", status: order.status,
    key: order.status === "paid" ? order.key : "",
    createdAt: order.createdAt, updatedAt: order.updatedAt
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
  const store = readStore();
  const expectedUser = store.adminCredentials?.username || process.env.ADMIN_USER || "admin";
  const passwordOk = verifyAdminPassword(pass, store.adminCredentials?.passwordHash);
  if (user !== expectedUser || !passwordOk) return res.status(401).json({ error: "Invalid username or password." });
  next();
}
function allocateKey(store, productId, planId) {
  const pool = Array.isArray(store.keyPool) ? store.keyPool : [];
  const idx = pool.findIndex(item => {
    if (typeof item === "string") return true; // legacy unassigned key
    return item.productId === productId && item.planId === planId;
  });
  if (idx < 0) return null;
  const item = pool.splice(idx, 1)[0];
  return typeof item === "string" ? item : item.key;
}
function fulfillPaidOrder(store, order, paymentId) {
  if (order.status === "paid" && order.key) return order;
  const key = allocateKey(store, order.productId, order.planId);
  if (!key) throw new Error("No key is available for this product and duration.");
  order.key = key;
  order.status = "paid";
  order.paymentReference = paymentId || order.paymentReference || "";
  order.paidAt = new Date().toISOString();
  order.updatedAt = order.paidAt;
  const product = store.products.find(p => p.id === order.productId);
  if (product) product.stock = Math.max(0, Number(product.stock || 0) - 1);
  return order;
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/products", (req, res) => res.sendFile(path.join(__dirname, "public", "products.html")));
app.get("/payment", (req, res) => res.sendFile(path.join(__dirname, "public", "payment.html")));
app.get("/status", (req, res) => res.sendFile(path.join(__dirname, "public", "status.html")));

app.get("/api/health", (req, res) => res.json({
  ok: true,
  app: "DELTA.KEYS",
  paymentMode: "manual-upi-admin-approval"
}));

app.get("/api/products", (req, res) => res.json(readStore().products.map(publicProduct)));

app.get("/api/payment-info", (req, res) => {
  const store = readStore();
  res.json({
    enabled: true,
    mode: "manual-upi-admin-approval",
    upiId: store.paymentSettings.upiId || process.env.UPI_ID || "",
    payeeName: store.paymentSettings.payeeName || process.env.PAYMENT_PAYEE_NAME || "DELTA.KEYS",
    qrImage: "/upi-qr.jpg"
  });
});

// Customer submits a manual UPI payment. The order stays pending until an admin
// verifies the payment and approves it in the admin dashboard.
app.post("/api/payments/create-order", (req, res) => {
  try {
    const { productId, planId, paymentReference } = req.body || {};
    const store = readStore();
    const product = store.products.find(p => p.id === productId);
    const plan = product && findPlan(product, planId);

    if (!product || !plan) return res.status(400).json({ error: "Product or duration not found." });
    if (Number(product.stock || 0) < 1) return res.status(400).json({ error: "This product is out of stock." });

    const available = store.keyPool.some(item =>
      typeof item === "string" || (item.productId === product.id && item.planId === plan.id)
    );
    if (!available) return res.status(400).json({ error: "No key is available for this duration yet." });

    const reference = String(paymentReference || "").trim();
    if (!reference) return res.status(400).json({ error: "UPI transaction ID / UTR is required." });
    if (reference.length < 4 || reference.length > 100) return res.status(400).json({ error: "Enter a valid UPI transaction ID / UTR." });

    const duplicate = store.orders.some(o =>
      o.paymentReference &&
      String(o.paymentReference).toLowerCase() === reference.toLowerCase() &&
      o.status !== "rejected"
    );
    if (duplicate) return res.status(409).json({ error: "This UPI transaction ID has already been submitted." });

    const localId = "DK-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    const now = new Date().toISOString();

    store.orders.unshift({
      id: localId,
      productId: product.id,
      productName: product.name,
      planId: plan.id,
      duration: plan.name,
      amount: Number(plan.price),
      paymentReference: reference,
      status: "pending",
      key: "",
      createdAt: now,
      updatedAt: now
    });

    writeStore(store);
    res.json({
      order: publicOrder(store.orders[0]),
      message: "Payment submitted. Your order is waiting for admin approval."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not create the order." });
  }
});

app.get("/api/orders/:id", (req, res) => {
  const order = readStore().orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json({ order: publicOrder(order) });
});

app.get("/api/admin/data", adminAuth, (req, res) => {
  const store = readStore();
  res.json({
    products: store.products, orders: store.orders.map(o => ({ ...o })),
    keyPoolCount: (store.keyPool || []).length,
    planCount: store.products.reduce((n,p) => n + (p.plans || []).length, 0),
    paymentSettings: store.paymentSettings
  });
});

app.put("/api/admin/sidebar-order", adminAuth, (req, res) => {
  const allowed = new Set(["dashboard","orders","products","keys","durations","settings","telegram"]);
  const order = Array.isArray(req.body?.order) ? req.body.order.filter(x => allowed.has(x)) : [];
  const unique = [...new Set(order)];
  for (const page of ["dashboard","orders","products","keys","durations","settings","telegram"]) if (!unique.includes(page)) unique.push(page);
  const store = readStore();
  store.sidebarOrder = unique;
  writeStore(store);
  res.json({ sidebarOrder: unique, message: "Admin menu order saved." });
});

app.put("/api/admin/payment-settings", adminAuth, (req, res) => {
  const upiId = String(req.body?.upiId || "").trim();
  const payeeName = String(req.body?.payeeName || "DELTA.KEYS").trim();
  if (!upiId) return res.status(400).json({ error: "Enter the UPI ID used to receive payments." });
  if (upiId.length > 120) return res.status(400).json({ error: "UPI ID is too long." });
  if (payeeName.length > 120) return res.status(400).json({ error: "Payee name is too long." });
  const store = readStore();
  store.paymentSettings = { upiId, payeeName: payeeName || "DELTA.KEYS" };
  writeStore(store);
  res.json({ paymentSettings: store.paymentSettings, message: "Payment settings updated." });
});

app.put("/api/admin/change-password", adminAuth, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");
  if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: "Fill all password fields." });
  if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: "New password and confirmation do not match." });
  const store = readStore();
  if (!verifyAdminPassword(currentPassword, store.adminCredentials?.passwordHash)) return res.status(401).json({ error: "Current password is incorrect." });
  store.adminCredentials = { username: store.adminCredentials?.username || process.env.ADMIN_USER || "admin", passwordHash: hashAdminPassword(newPassword) };
  writeStore(store);
  res.json({ message: "Admin password changed successfully. Please log in again with your new password." });
});

app.put("/api/admin/orders/:id", adminAuth, (req, res) => {
  try {
    const store = readStore();
    const order = store.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });

    const { status, key, customerName, customerContact, paymentReference } = req.body || {};
    if (status && !["pending", "paid", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    if (typeof customerName === "string") order.customerName = customerName.trim();
    if (typeof customerContact === "string") order.customerContact = customerContact.trim();
    if (typeof paymentReference === "string") order.paymentReference = paymentReference.trim();
    if (typeof key === "string" && key.trim()) order.key = key.trim();

    // Approval is the only action that releases a key to the customer.
    if (status === "paid") {
      if (!order.key) {
        fulfillPaidOrder(store, order, order.paymentReference || "ADMIN_APPROVED");
      } else {
        order.status = "paid";
        order.paidAt = order.paidAt || new Date().toISOString();
        order.updatedAt = new Date().toISOString();
      }
    } else if (status === "rejected") {
      order.status = "rejected";
      order.key = "";
      order.rejectedAt = new Date().toISOString();
      order.updatedAt = order.rejectedAt;
    } else if (status === "pending") {
      order.status = "pending";
      order.key = "";
      order.updatedAt = new Date().toISOString();
    } else {
      order.updatedAt = new Date().toISOString();
    }

    writeStore(store);
    res.json({ order: publicOrder(order) });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Could not update order." });
  }
});

app.post("/api/admin/keys", adminAuth, (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys : String(req.body?.keys || "").split(/\r?\n/);
  const productId = String(req.body?.productId || "");
  const planId = String(req.body?.planId || "");
  const clean = keys.map(k => String(k).trim()).filter(Boolean);
  if (!clean.length) return res.status(400).json({ error: "No keys supplied." });
  if (!productId || !planId) return res.status(400).json({ error: "Select a product and duration before uploading keys." });
  const store = readStore();
  const product = store.products.find(p => p.id === productId);
  if (!product || !findPlan(product, planId)) return res.status(400).json({ error: "Product or duration not found." });
  store.keyPool = Array.isArray(store.keyPool) ? store.keyPool : [];
  store.keyPool.push(...clean.map(key => ({ key, productId, planId })));
  writeStore(store);
  res.json({ added: clean.length, total: store.keyPool.length });
});

app.post("/api/admin/products", adminAuth, (req, res) => {
  const store = readStore();
  const { name, price, stock, description, badge, durationName, durationHours, durationPrice } = req.body || {};
  if (!String(name || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: "Product name and valid price are required." });
  const planName = String(durationName || "Default").trim();
  const plan = { id: "plan-" + crypto.randomBytes(4).toString("hex"), name: planName, durationHours: Math.max(0, Number(durationHours || 0)), price: Number(durationPrice ?? price), active: true };
  const product = {
    id: "product-" + crypto.randomBytes(5).toString("hex"),
    name: String(name).trim(), price: Number(price), stock: Math.max(0, Math.floor(Number(stock || 0))),
    description: String(description || "").trim(), badge: String(badge || "NEW").trim(), plans: [plan]
  };
  store.products.push(product); writeStore(store); res.status(201).json({ product });
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
  writeStore(store); res.json({ product });
});

app.post("/api/admin/plans", adminAuth, (req, res) => {
  const store = readStore();
  const { productId, name, durationHours, price } = req.body || {};
  const product = store.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (!String(name || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: "Duration name and valid price are required." });
  product.plans = Array.isArray(product.plans) ? product.plans : [];
  const plan = { id: "plan-" + crypto.randomBytes(4).toString("hex"), name: String(name).trim(), durationHours: Math.max(0, Number(durationHours || 0)), price: Number(price), active: true };
  product.plans.push(plan);
  writeStore(store); res.status(201).json({ plan });
});
app.put("/api/admin/plans/:productId/:planId", adminAuth, (req, res) => {
  const store = readStore();
  const product = store.products.find(p => p.id === req.params.productId);
  const plan = product && (product.plans || []).find(x => x.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: "Duration not found." });
  const { name, durationHours, price, active } = req.body || {};
  if (typeof name === "string" && name.trim()) plan.name = name.trim();
  if (Number.isFinite(Number(durationHours)) && Number(durationHours) >= 0) plan.durationHours = Number(durationHours);
  if (Number.isFinite(Number(price)) && Number(price) >= 0) plan.price = Number(price);
  if (typeof active === "boolean") plan.active = active;
  writeStore(store); res.json({ plan });
});
app.delete("/api/admin/plans/:productId/:planId", adminAuth, (req, res) => {
  const store = readStore();
  const product = store.products.find(p => p.id === req.params.productId);
  if (!product) return res.status(404).json({ error: "Product not found." });
  product.plans = (product.plans || []).filter(x => x.id !== req.params.planId);
  writeStore(store); res.json({ ok: true });
});
app.delete("/api/admin/products/:id", adminAuth, (req, res) => {
  const store = readStore();
  const before = store.products.length;
  store.products = store.products.filter(p => p.id !== req.params.id);
  if (before === store.products.length) return res.status(404).json({ error: "Product not found." });
  writeStore(store); res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => console.log(`DELTA.KEYS running on port ${PORT} — manual UPI payment + admin approval mode`));
