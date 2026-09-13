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
      keyPool: []
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
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "change-this-password";
  if (user !== expectedUser || pass !== expectedPass) return res.status(401).json({ error: "Invalid username or password." });
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


const CF_API_VERSION = "2025-01-01";
function cashfreeConfigured() {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}
function cashfreeBaseUrl() {
  return (process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}
function cashfreeHeaders(extra = {}) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-version": CF_API_VERSION,
    "x-client-id": process.env.CASHFREE_APP_ID || "",
    "x-client-secret": process.env.CASHFREE_SECRET_KEY || "",
    ...extra
  };
}
async function cashfreeRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const message = body?.message || body?.error || body?.type || `Cashfree request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return body;
}
function absoluteUrl(req, pathname) {
  const configured = String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured + pathname;
  return `${req.protocol}://${req.get("host")}${pathname}`;
}
function verifyCashfreeWebhook(req) {
  const signature = req.get("x-webhook-signature") || "";
  const timestamp = req.get("x-webhook-timestamp") || "";
  if (!signature || !timestamp || !process.env.CASHFREE_SECRET_KEY || !req.rawBody) return false;
  const signedPayload = `${timestamp}${req.rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(signedPayload).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}
function fulfillCashfreeOrder(localOrderId, paymentId) {
  const store = readStore();
  const order = store.orders.find(o => o.id === localOrderId);
  if (!order) throw new Error("Local order not found.");
  if (order.status === "paid" && order.key) return order;
  const key = allocateKey(store, order.productId, order.planId);
  if (!key) throw new Error("No key is available for this product and duration.");
  order.key = key;
  order.status = "paid";
  order.paymentReference = paymentId || order.paymentReference || "CASHFREE";
  order.paidAt = new Date().toISOString();
  order.updatedAt = order.paidAt;
  const product = store.products.find(p => p.id === order.productId);
  if (product) product.stock = Math.max(0, Number(product.stock || 0) - 1);
  writeStore(store);
  return order;
}

app.get("/api/health", (req, res) => res.json({
  ok: true,
  app: "DELTA.KEYS",
  paymentMode: cashfreeConfigured() ? "cashfree-upi-auto" : "cashfree-not-configured"
}));

app.get("/api/products", (req, res) => res.json(readStore().products.map(publicProduct)));

app.get("/api/payment-info", (req, res) => res.json({
  enabled: cashfreeConfigured(),
  mode: "cashfree-upi-auto",
  environment: (process.env.CASHFREE_ENV || "sandbox").toLowerCase(),
  upiId: process.env.UPI_ID || "",
  payeeName: process.env.PAYMENT_PAYEE_NAME || "DELTA.KEYS",
  qrImage: "/upi-qr.jpg"
}));

// Create a Cashfree payment order. Customer details are generated server-side;
// the storefront does not ask the customer for name or phone.
app.post("/api/payments/create-order", async (req, res) => {
  try {
    if (!cashfreeConfigured()) return res.status(503).json({ error: "Automatic UPI payment is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY." });
    const { productId, planId } = req.body || {};
    const store = readStore();
    const product = store.products.find(p => p.id === productId);
    const plan = product && findPlan(product, planId);
    if (!product || !plan) return res.status(400).json({ error: "Product or duration not found." });
    if (Number(product.stock || 0) < 1) return res.status(400).json({ error: "This product is out of stock." });
    const available = store.keyPool.some(item => typeof item === "string" || (item.productId === product.id && item.planId === plan.id));
    if (!available) return res.status(400).json({ error: "No key is available for this duration yet." });

    const localId = "DK-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    const now = new Date().toISOString();
    const order = {
      id: localId, productId: product.id, productName: product.name, planId: plan.id,
      duration: plan.name, amount: Number(plan.price), paymentReference: "", status: "pending", key: "",
      cashfreeOrderId: localId, cashfreePaymentSessionId: "", createdAt: now, updatedAt: now
    };
    store.orders.unshift(order);
    writeStore(store);

    const customerPhone = String(process.env.CASHFREE_CUSTOMER_PHONE || "9999999999").replace(/\D/g, "").slice(-10);
    const payload = {
      order_id: localId,
      order_amount: Number(plan.price),
      order_currency: "INR",
      customer_details: { customer_id: localId, customer_phone: customerPhone || "9999999999" },
      order_note: `${product.name} - ${plan.name}`,
      order_meta: {
        return_url: absoluteUrl(req, `/payment?order=${encodeURIComponent(localId)}`),
        notify_url: absoluteUrl(req, "/api/webhooks/cashfree"),
        payment_methods: "upi"
      },
      order_tags: { delta_order: localId, product_id: product.id, plan_id: plan.id }
    };
    const cf = await cashfreeRequest(`${cashfreeBaseUrl()}/orders`, {
      method: "POST",
      headers: cashfreeHeaders({ "x-idempotency-key": crypto.randomUUID() }),
      body: JSON.stringify(payload)
    });
    order.cashfreeOrderId = cf.order_id || localId;
    order.cashfreePaymentSessionId = cf.payment_session_id || "";
    order.updatedAt = new Date().toISOString();
    writeStore(readStore());
    const saved = readStore();
    const savedOrder = saved.orders.find(o => o.id === localId);
    savedOrder.cashfreeOrderId = order.cashfreeOrderId;
    savedOrder.cashfreePaymentSessionId = order.cashfreePaymentSessionId;
    savedOrder.updatedAt = order.updatedAt;
    writeStore(saved);
    res.json({ order: publicOrder(savedOrder), paymentSessionId: order.cashfreePaymentSessionId, cashfreeMode: (process.env.CASHFREE_ENV || "sandbox").toLowerCase() });
  } catch (e) {
    console.error("Cashfree create order error:", e.body || e);
    res.status(e.status && e.status < 500 ? e.status : 500).json({ error: e.message || "Could not create payment." });
  }
});

// Cashfree payment success webhook. Signature is verified before fulfilment.
app.post("/api/webhooks/cashfree", (req, res) => {
  try {
    if (!verifyCashfreeWebhook(req)) return res.status(401).json({ error: "Invalid webhook signature." });
    const event = req.body || {};
    const localId = event?.data?.order?.order_id;
    const payment = event?.data?.payment;
    if (!localId || !payment) return res.json({ ok: true });
    if (payment.payment_status === "SUCCESS") {
      try { fulfillCashfreeOrder(localId, String(payment.cf_payment_id || payment.bank_reference || "CASHFREE")); }
      catch (e) { console.error("Fulfilment error:", e); return res.status(500).json({ error: e.message }); }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Cashfree webhook error:", e);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// Reconciliation endpoint used by the checkout page. This independently checks
// Cashfree so fulfilment does not depend on a browser callback alone.
app.get("/api/payments/status/:id", async (req, res) => {
  try {
    const store = readStore();
    const order = store.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.status !== "paid" && cashfreeConfigured() && order.cashfreeOrderId) {
      const payments = await cashfreeRequest(`${cashfreeBaseUrl()}/orders/${encodeURIComponent(order.cashfreeOrderId)}/payments`, {
        method: "GET", headers: cashfreeHeaders()
      });
      const success = Array.isArray(payments) && payments.find(p => p.payment_status === "SUCCESS");
      if (success) {
        try { fulfillCashfreeOrder(order.id, String(success.cf_payment_id || success.bank_reference || "CASHFREE")); }
        catch (e) { return res.status(409).json({ error: e.message, order: publicOrder(order) }); }
      }
    }
    const latest = readStore().orders.find(o => o.id === req.params.id);
    res.json({ order: publicOrder(latest), paid: latest.status === "paid" });
  } catch (e) {
    console.error("Payment status error:", e.body || e);
    res.status(500).json({ error: "Could not check payment status." });
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
    planCount: store.products.reduce((n,p) => n + (p.plans || []).length, 0)
  });
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
