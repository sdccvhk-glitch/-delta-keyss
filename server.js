const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_BEFORE_PRODUCTION";

const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, "data");

fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "wfn.sqlite");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reseller',
  balance REAL NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(referred_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT UNIQUE NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'Standard',
  price REAL NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active',
  device_id TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referred_user_id INTEGER NOT NULL,
  reward REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(referrer_id) REFERENCES users(id),
  FOREIGN KEY(referred_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS balance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL,
  used_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(used_by) REFERENCES users(id)
);
`);

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing("users", "referred_by", "INTEGER");

function ensureOwner() {
  const owner = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
  if (!owner) {
    const username = process.env.OWNER_USERNAME || "owner";
    const password = process.env.OWNER_PASSWORD || "owner123";
    const hash = bcrypt.hashSync(password, 10);
    const referral = "OWNER-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    db.prepare(`
      INSERT INTO users (username,password_hash,role,balance,referral_code)
      VALUES (?,?,?,?,?)
    `).run(username, hash, "owner", 0, referral);
  }
}
ensureOwner();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function signUser(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function adminOnly(req, res, next) {
  if (!["owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function makeCode(prefix = "REF") {
  return `${prefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "WE FEAR NONE" });
});

/* Registration: referral code is required and must have been created by admin. */
app.post("/api/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const referralCode = String(req.body.referral_code || req.body.referralCode || "").trim();

  if (!username || !password || !referralCode) {
    return res.status(400).json({ error: "Username, password and referral code are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const ref = db.prepare(`
    SELECT * FROM referral_codes
    WHERE code = ? AND used_by IS NULL
  `).get(referralCode);

  if (!ref) {
    return res.status(400).json({ error: "Invalid or already used referral code" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return res.status(409).json({ error: "Username already exists" });

  const hash = bcrypt.hashSync(password, 10);

  const createUser = db.transaction(() => {
    const generatedPersonalCode = makeCode("USR");

    const result = db.prepare(`
      INSERT INTO users
        (username,password_hash,role,balance,referral_code,referred_by)
      VALUES (?,?,?,?,?,?)
    `).run(
      username,
      hash,
      "reseller",
      Number(ref.balance),
      generatedPersonalCode,
      ref.created_by
    );

    const userId = Number(result.lastInsertRowid);

    db.prepare(`
      UPDATE referral_codes
      SET used_by = ?, used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId, ref.id);

    db.prepare(`
      INSERT INTO referrals (referrer_id,referred_user_id,reward)
      VALUES (?,?,?)
    `).run(ref.created_by, userId, Number(ref.balance));

    db.prepare(`
      INSERT INTO balance_transactions
        (user_id,amount,type,note,created_by)
      VALUES (?,?,?,?,?)
    `).run(
      userId,
      Number(ref.balance),
      "referral_credit",
      `Referral code ${ref.code}`,
      ref.created_by
    );

    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  });

  try {
    const user = createUser();
    const token = signUser(user);
    res.json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        balance: user.balance
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = signUser(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      balance: user.balance
    }
  });
});

app.get("/api/me", auth, (req, res) => {
  const user = db.prepare(`
    SELECT id,username,role,balance,referral_code,created_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

/* Balance visible to admin/customer pages. */
app.get("/api/balance", auth, (req, res) => {
  const user = db.prepare("SELECT id,username,role,balance FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ balance: Number(user.balance), username: user.username, role: user.role });
});

/* Only owner/admin can create referral codes. */
app.post("/api/admin/referral-codes", auth, adminOnly, (req, res) => {
  const balance = Number(req.body.balance);
  const requestedCode = String(req.body.code || "").trim().toUpperCase();

  if (!Number.isFinite(balance) || balance < 0) {
    return res.status(400).json({ error: "A valid referral balance is required" });
  }

  const code = requestedCode || makeCode("REF");
  if (!/^[A-Z0-9_-]{4,40}$/.test(code)) {
    return res.status(400).json({ error: "Referral code must be 4-40 characters" });
  }

  try {
    const result = db.prepare(`
      INSERT INTO referral_codes (code,balance,created_by)
      VALUES (?,?,?)
    `).run(code, balance, req.user.id);

    res.json({
      message: "Referral code created",
      referral: {
        id: result.lastInsertRowid,
        code,
        balance
      }
    });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Referral code already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create referral code" });
  }
});

app.get("/api/admin/referral-codes", auth, adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT rc.id,rc.code,rc.balance,rc.used_by,rc.created_at,rc.used_at,
           u.username AS used_by_username
    FROM referral_codes rc
    LEFT JOIN users u ON u.id = rc.used_by
    ORDER BY rc.id DESC
  `).all();
  res.json({ referrals: rows });
});

/* Admin can add balance to a user. */
app.post("/api/admin/users/:id/balance", auth, adminOnly, (req, res) => {
  const userId = Number(req.params.id);
  const amount = Number(req.body.amount);
  const note = String(req.body.note || "Admin balance adjustment");

  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: "Amount must be a non-zero number" });
  }

  const tx = db.transaction(() => {
    const user = db.prepare("SELECT id,balance FROM users WHERE id = ?").get(userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const newBalance = Number(user.balance) + amount;
    if (newBalance < 0) throw new Error("INSUFFICIENT_BALANCE");

    db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, userId);
    db.prepare(`
      INSERT INTO balance_transactions
        (user_id,amount,type,note,created_by)
      VALUES (?,?,?,?,?)
    `).run(userId, amount, amount > 0 ? "admin_credit" : "admin_debit", note, req.user.id);

    return newBalance;
  });

  try {
    res.json({ message: "Balance updated", balance: tx() });
  } catch (err) {
    if (err.message === "USER_NOT_FOUND") return res.status(404).json({ error: "User not found" });
    if (err.message === "INSUFFICIENT_BALANCE") return res.status(400).json({ error: "Insufficient balance" });
    console.error(err);
    res.status(500).json({ error: "Could not update balance" });
  }
});

/*
  Generate one license and charge the creator's balance.
  Price is taken from the request; production UI should select a server-side product price.
*/
app.post("/api/licenses/generate", auth, (req, res) => {
  const price = Number(req.body.price);
  const licenseType = String(req.body.license_type || "Standard");
  const durationDays = Number(req.body.duration_days || 30);

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "Invalid key price" });
  }
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    return res.status(400).json({ error: "Invalid duration" });
  }

  const generate = db.transaction(() => {
    const user = db.prepare("SELECT id,balance FROM users WHERE id = ?").get(req.user.id);
    if (!user) throw new Error("USER_NOT_FOUND");
    if (Number(user.balance) < price) throw new Error("INSUFFICIENT_BALANCE");

    const licenseKey = crypto.randomBytes(16).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");
    const expires = new Date(Date.now() + durationDays * 86400000).toISOString();

    db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(price, user.id);

    const result = db.prepare(`
      INSERT INTO licenses
        (license_key,license_type,price,duration_days,status,created_by,expires_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      licenseKey,
      licenseType,
      price,
      durationDays,
      "active",
      user.id,
      expires
    );

    db.prepare(`
      INSERT INTO balance_transactions
        (user_id,amount,type,note,created_by)
      VALUES (?,?,?,?,?)
    `).run(
      user.id,
      -price,
      "license_purchase",
      `License ${licenseKey}`,
      user.id
    );

    const updated = db.prepare("SELECT balance FROM users WHERE id = ?").get(user.id);
    return {
      id: result.lastInsertRowid,
      license_key: licenseKey,
      price,
      duration_days: durationDays,
      balance: Number(updated.balance)
    };
  });

  try {
    res.json(generate());
  } catch (err) {
    if (err.message === "USER_NOT_FOUND") return res.status(404).json({ error: "User not found" });
    if (err.message === "INSUFFICIENT_BALANCE") return res.status(400).json({ error: "Insufficient balance" });
    console.error(err);
    res.status(500).json({ error: "Could not generate license" });
  }
});

/* Admin user list with balances. */
app.get("/api/admin/users", auth, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT id,username,role,balance,referral_code,referred_by,created_at
    FROM users ORDER BY id DESC
  `).all();
  res.json({ users });
});

/* Serve the website. */
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));



app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WE FEAR NONE running on port ${PORT}`);
});
