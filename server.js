
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_BEFORE_PRODUCTION";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "wfn.sqlite");

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
`);

const defaults = {
  panel_name: "WE FEAR NONE",
  license_name: "Standard",
  license_price: "100",
  referral_reward: "10"
};
for (const [k,v] of Object.entries(defaults)) {
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(k,v);
}

function setting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? row.value : "";
}
function setSetting(key,value) {
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,String(value));
}
function randomCode(prefix="WFN") {
  return prefix + "-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}
function makeLicense() {
  return "WFN-" + crypto.randomBytes(5).toString("hex").toUpperCase() + "-" +
    crypto.randomBytes(5).toString("hex").toUpperCase();
}
function addDays(days) {
  return new Date(Date.now() + Number(days)*86400000).toISOString();
}
function log(userId, action, details="") {
  db.prepare("INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)")
    .run(userId || null, action, details);
}

const ownerHash = bcrypt.hashSync(process.env.OWNER_PASSWORD || "owner123", 12);
db.prepare(`
  INSERT OR IGNORE INTO users(username,password_hash,role,referral_code)
  VALUES('owner',?,?,?)
`).run(ownerHash,"owner",randomCode("REF"));

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/,"");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({error:"Unauthorized"});
  }
}
function roles(...allowed) {
  return (req,res,next) => allowed.includes(req.user.role)
    ? next() : res.status(403).json({error:"Permission denied"});
}
function getUser(id) {
  return db.prepare("SELECT id,username,role,balance,referral_code,referred_by,created_at FROM users WHERE id=?").get(id);
}
function requireBody(res, obj, fields) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim()==="")
      return res.status(400).json({error:`${f} is required`});
  }
  return null;
}

/* AUTH */
app.post("/api/auth/register",(req,res)=>{
  const bad=requireBody(res,req.body,["username","password"]);
  if(bad) return;
  const username=String(req.body.username).trim();
  if(username.length<3) return res.status(400).json({error:"Username must be at least 3 characters"});
  if(db.prepare("SELECT id FROM users WHERE lower(username)=lower(?)").get(username))
    return res.status(409).json({error:"Username already exists"});
  let referrer=null;
  if(req.body.referral) referrer=db.prepare("SELECT id FROM users WHERE referral_code=?").get(String(req.body.referral).trim());
  const info=db.prepare(`
    INSERT INTO users(username,password_hash,role,referral_code,referred_by)
    VALUES(?,?,?,?,?)
  `).run(username,bcrypt.hashSync(String(req.body.password),12),"reseller",randomCode("REF"),referrer?.id || null);
  const newId=Number(info.lastInsertRowid);
  if(referrer) {
    const reward=Number(setting("referral_reward"))||0;
    if(reward) {
      db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(reward,referrer.id);
      db.prepare("INSERT INTO referrals(referrer_id,referred_user_id,reward) VALUES(?,?,?)").run(referrer.id,newId,reward);
      db.prepare("INSERT INTO balance_transactions(user_id,amount,type,note) VALUES(?,?,?,?)")
        .run(referrer.id,reward,"referral","Referral reward");
    }
  }
  res.json({success:true});
});

app.post("/api/auth/login",(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE username=?").get(String(req.body.username||""));
  if(!u || !bcrypt.compareSync(String(req.body.password||""),u.password_hash))
    return res.status(401).json({error:"Invalid username or password"});
  const token=jwt.sign({id:u.id,username:u.username,role:u.role},JWT_SECRET,{expiresIn:"7d"});
  log(u.id,"login");
  res.json({token,user:getUser(u.id)});
});

app.get("/api/me",auth,(req,res)=>{
  const u=getUser(req.user.id);
  if(!u) return res.status(404).json({error:"User not found"});
  res.json(u);
});

app.post("/api/profile/username",auth,(req,res)=>{
  const username=String(req.body.username||"").trim();
  if(username.length<3) return res.status(400).json({error:"Username must be at least 3 characters"});
  if(db.prepare("SELECT id FROM users WHERE lower(username)=lower(?) AND id<>?").get(username,req.user.id))
    return res.status(409).json({error:"Username already exists"});
  db.prepare("UPDATE users SET username=? WHERE id=?").run(username,req.user.id);
  log(req.user.id,"change_username",username);
  res.json({success:true});
});

app.post("/api/profile/password",auth,(req,res)=>{
  if(!req.body.password || String(req.body.password).length<6)
    return res.status(400).json({error:"Password must be at least 6 characters"});
  db.prepare("UPDATE users SET password_hash=? WHERE id=?")
    .run(bcrypt.hashSync(String(req.body.password),12),req.user.id);
  log(req.user.id,"change_password");
  res.json({success:true});
});

/* DASHBOARD */
app.get("/api/dashboard",auth,(req,res)=>{
  const counts=db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) users,
      (SELECT COUNT(*) FROM licenses) licenses,
      (SELECT COUNT(*) FROM licenses WHERE status='active' AND datetime(expires_at)>datetime('now')) active,
      (SELECT COUNT(*) FROM licenses WHERE status='expired' OR datetime(expires_at)<=datetime('now')) expired
  `).get();
  const mine=db.prepare("SELECT COUNT(*) c FROM licenses WHERE created_by=?").get(req.user.id).c;
  res.json({...counts,my_licenses:mine,panel_name:setting("panel_name"),license_price:Number(setting("license_price"))});
});

/* SETTINGS / PRICING / LICENSE CONFIG */
app.get("/api/settings",auth,(req,res)=>{
  res.json({
    panel_name:setting("panel_name"),
    license_name:setting("license_name"),
    license_price:Number(setting("license_price")),
    referral_reward:Number(setting("referral_reward"))
  });
});

app.post("/api/settings",auth,roles("owner"),(req,res)=>{
  if(req.body.panel_name!==undefined) setSetting("panel_name",String(req.body.panel_name).trim()||"WE FEAR NONE");
  if(req.body.license_name!==undefined) setSetting("license_name",String(req.body.license_name).trim()||"Standard");
  if(req.body.license_price!==undefined) setSetting("license_price",Math.max(0,Number(req.body.license_price)||0));
  if(req.body.referral_reward!==undefined) setSetting("referral_reward",Math.max(0,Number(req.body.referral_reward)||0));
  log(req.user.id,"change_settings");
  res.json({success:true});
});

/* USERS */
app.get("/api/users",auth,roles("owner","admin"),(req,res)=>{
  res.json(db.prepare(`
    SELECT id,username,role,balance,referral_code,created_at FROM users ORDER BY id DESC
  `).all());
});

app.post("/api/users/:id/role",auth,roles("owner"),(req,res)=>{
  const role=String(req.body.role||"").toLowerCase();
  if(!["admin","reseller"].includes(role)) return res.status(400).json({error:"Role must be admin or reseller"});
  const u=db.prepare("SELECT role FROM users WHERE id=?").get(Number(req.params.id));
  if(!u) return res.status(404).json({error:"User not found"});
  db.prepare("UPDATE users SET role=? WHERE id=?").run(role,Number(req.params.id));
  log(req.user.id,"change_role",`${req.params.id}:${role}`);
  res.json({success:true});
});

app.post("/api/users/:id/balance",auth,roles("owner","admin"),(req,res)=>{
  const id=Number(req.params.id), amount=Number(req.body.amount);
  if(!Number.isFinite(amount) || amount===0) return res.status(400).json({error:"Invalid amount"});
  const u=getUser(id);
  if(!u) return res.status(404).json({error:"User not found"});
  db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(amount,id);
  db.prepare("INSERT INTO balance_transactions(user_id,amount,type,note,created_by) VALUES(?,?,?,?,?)")
    .run(id,amount,amount>0?"credit":"debit",String(req.body.note||"Balance adjustment"),req.user.id);
  log(req.user.id,"balance_change",`${id}:${amount}`);
  res.json({success:true,balance:getUser(id).balance});
});

app.delete("/api/users/:id",auth,roles("owner"),(req,res)=>{
  const id=Number(req.params.id);
  const u=db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if(!u) return res.status(404).json({error:"User not found"});
  if(u.role==="owner") return res.status(400).json({error:"Owner cannot be deleted"});
  db.prepare("DELETE FROM referrals WHERE referrer_id=? OR referred_user_id=?").run(id,id);
  db.prepare("DELETE FROM balance_transactions WHERE user_id=? OR created_by=?").run(id,id);
  db.prepare("DELETE FROM licenses WHERE created_by=?").run(id);
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  log(req.user.id,"delete_user",String(id));
  res.json({success:true});
});

/* REFERRALS */
app.get("/api/referrals",auth,(req,res)=>{
  const rows=db.prepare(`
    SELECT r.id,r.reward,r.created_at,u.username referred_username
    FROM referrals r JOIN users u ON u.id=r.referred_user_id
    WHERE r.referrer_id=? ORDER BY r.id DESC
  `).all(req.user.id);
  res.json({code:getUser(req.user.id).referral_code,reward:Number(setting("referral_reward")),items:rows});
});

/* LICENSES */
function normalizedExpiry(days) { return addDays(Math.max(1,Number(days)||30)); }

app.post("/api/licenses/generate",auth,roles("owner","admin","reseller"),(req,res)=>{
  const count=Math.max(1,Math.min(100,Number(req.body.count)||1));
  const days=Math.max(1,Number(req.body.days)||30);
  const type=String(req.body.license_type||setting("license_name")||"Standard").trim();
  const price=Math.max(0,Number(req.body.price ?? setting("license_price"))||0);
  const custom=String(req.body.custom||"").trim();
  const created=[];
  const insert=db.prepare(`
    INSERT INTO licenses(license_key,license_type,price,duration_days,status,created_by,expires_at)
    VALUES(?,?,?,?,?,?,?)
  `);
  const tx=db.transaction(()=>{
    for(let i=0;i<count;i++){
      let key=(i===0 && custom) ? custom : makeLicense();
      if(db.prepare("SELECT id FROM licenses WHERE license_key=?").get(key)) continue;
      const info=insert.run(key,type,price,days,"active",req.user.id,normalizedExpiry(days));
      created.push(db.prepare("SELECT * FROM licenses WHERE id=?").get(info.lastInsertRowid));
    }
  });
  tx();
  log(req.user.id,"generate_keys",`count=${created.length}`);
  res.json({success:true,licenses:created});
});

app.get("/api/licenses",auth,roles("owner","admin","reseller"),(req,res)=>{
  const where=req.user.role==="reseller" ? "WHERE created_by=?" : "";
  const args=req.user.role==="reseller" ? [req.user.id] : [];
  res.json(db.prepare(`
    SELECT l.*,u.username created_by_username
    FROM licenses l LEFT JOIN users u ON u.id=l.created_by
    ${where} ORDER BY l.id DESC
  `).all(...args));
});

app.post("/api/licenses/:id/extend",auth,roles("owner","admin","reseller"),(req,res)=>{
  const id=Number(req.params.id);
  const l=db.prepare("SELECT * FROM licenses WHERE id=?").get(id);
  if(!l) return res.status(404).json({error:"License not found"});
  if(req.user.role==="reseller" && l.created_by!==req.user.id)
    return res.status(403).json({error:"You can only manage your keys"});
  const days=Math.max(1,Number(req.body.days)||30);
  const base=Math.max(Date.now(),new Date(l.expires_at).getTime());
  const expires=new Date(base+days*86400000).toISOString();
  db.prepare("UPDATE licenses SET duration_days=?,expires_at=?,status='active' WHERE id=?").run(days,expires,id);
  res.json({success:true,license:db.prepare("SELECT * FROM licenses WHERE id=?").get(id)});
});

app.post("/api/licenses/extend-all",auth,roles("owner","admin","reseller"),(req,res)=>{
  const days=Math.max(1,Number(req.body.days)||30);
  let rows;
  if(req.user.role==="reseller") rows=db.prepare("SELECT * FROM licenses WHERE created_by=?").all(req.user.id);
  else rows=db.prepare("SELECT * FROM licenses").all();
  const tx=db.transaction(()=>{
    for(const l of rows) {
      const base=Math.max(Date.now(),new Date(l.expires_at).getTime());
      db.prepare("UPDATE licenses SET duration_days=?,expires_at=?,status='active' WHERE id=?")
        .run(days,new Date(base+days*86400000).toISOString(),l.id);
    }
  });
  tx();
  res.json({success:true,count:rows.length});
});

app.post("/api/licenses/reset-all",auth,roles("owner","admin"),(req,res)=>{
  db.prepare("UPDATE licenses SET device_id=NULL").run();
  log(req.user.id,"reset_all_devices");
  res.json({success:true});
});

app.post("/api/licenses/:id/reset-device",auth,roles("owner","admin","reseller"),(req,res)=>{
  const id=Number(req.params.id), l=db.prepare("SELECT * FROM licenses WHERE id=?").get(id);
  if(!l) return res.status(404).json({error:"License not found"});
  if(req.user.role==="reseller" && l.created_by!==req.user.id) return res.status(403).json({error:"Forbidden"});
  db.prepare("UPDATE licenses SET device_id=NULL WHERE id=?").run(id);
  res.json({success:true});
});

app.delete("/api/licenses/all",auth,roles("owner"),(req,res)=>{
  db.prepare("DELETE FROM licenses").run();
  log(req.user.id,"delete_all_keys");
  res.json({success:true});
});

app.delete("/api/licenses/:id",auth,roles("owner","admin","reseller"),(req,res)=>{
  const id=Number(req.params.id), l=db.prepare("SELECT * FROM licenses WHERE id=?").get(id);
  if(!l) return res.status(404).json({error:"License not found"});
  if(req.user.role==="reseller" && l.created_by!==req.user.id) return res.status(403).json({error:"Forbidden"});
  db.prepare("DELETE FROM licenses WHERE id=?").run(id);
  res.json({success:true});
});

app.post("/api/licenses/:id/change",auth,roles("owner","admin"),(req,res)=>{
  const id=Number(req.params.id), l=db.prepare("SELECT * FROM licenses WHERE id=?").get(id);
  if(!l) return res.status(404).json({error:"License not found"});
  const type=String(req.body.license_type||l.license_type);
  const price=Math.max(0,Number(req.body.price ?? l.price)||0);
  const days=Math.max(1,Number(req.body.days ?? l.duration_days)||1);
  db.prepare("UPDATE licenses SET license_type=?,price=?,duration_days=? WHERE id=?").run(type,price,days,id);
  res.json({success:true});
});

/* APK LICENSE SERVER */
app.post("/api/license/check",(req,res)=>{
  const key=String(req.body.key||"").trim();
  const deviceId=String(req.body.deviceId||"").trim();
  if(!key) return res.status(400).json({valid:false,reason:"missing_key"});
  const l=db.prepare("SELECT * FROM licenses WHERE license_key=?").get(key);
  if(!l) return res.json({valid:false,reason:"invalid_key"});
  if(l.status!=="active") return res.json({valid:false,reason:l.status});
  if(new Date(l.expires_at).getTime()<=Date.now()) {
    db.prepare("UPDATE licenses SET status='expired' WHERE id=?").run(l.id);
    return res.json({valid:false,reason:"expired"});
  }
  if(!deviceId) return res.json({valid:false,reason:"missing_device_id"});
  if(!l.device_id) {
    db.prepare("UPDATE licenses SET device_id=? WHERE id=?").run(deviceId,l.id);
  } else if(l.device_id!==deviceId) {
    return res.json({valid:false,reason:"device_mismatch"});
  }
  res.json({
    valid:true,
    license:l.license_key,
    type:l.license_type,
    expiresAt:l.expires_at,
    deviceBound:true
  });
});

/* Catch-all without Express 5 "*" route */
app.use((req,res,next)=>{
  if(req.method!=="GET") return next();
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:"Internal server error"});
});

app.listen(PORT,()=>console.log(`WE FEAR NONE running on port ${PORT}`));
