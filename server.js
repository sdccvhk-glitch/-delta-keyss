const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_IN_PRODUCTION";

const users = [];
const licenses = [];

function makeKey(prefix="WFN") {
  const a = crypto.randomBytes(4).toString("hex").toUpperCase();
  const b = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${a}-${b}`;
}

function auth(req,res,next) {
  const token=(req.headers.authorization||"").replace("Bearer ","");
  try { req.user=jwt.verify(token,JWT_SECRET); next(); }
  catch { res.status(401).json({error:"Unauthorized"}); }
}

function role(...roles) {
  return (req,res,next)=> roles.includes(req.user.role) ? next() : res.status(403).json({error:"Forbidden"});
}

users.push({
  id:1, username:"owner", role:"owner",
  password:bcrypt.hashSync("owner123",10), balance:0
});

app.post("/api/auth/register",(req,res)=>{
  const {username,password,referral=""}=req.body;
  if(!username||!password) return res.status(400).json({error:"Username and password required"});
  if(users.some(u=>u.username.toLowerCase()===username.toLowerCase()))
    return res.status(409).json({error:"Username already exists"});
  const user={id:users.length+1,username,role:"reseller",password:bcrypt.hashSync(password,10),balance:0,referral};
  users.push(user);
  res.json({success:true});
});

app.post("/api/auth/login",(req,res)=>{
  const u=users.find(x=>x.username===req.body.username);
  if(!u||!bcrypt.compareSync(req.body.password||"",u.password))
    return res.status(401).json({error:"Invalid login"});
  const token=jwt.sign({id:u.id,username:u.username,role:u.role},JWT_SECRET,{expiresIn:"7d"});
  res.json({token,user:{id:u.id,username:u.username,role:u.role,balance:u.balance}});
});

app.get("/api/me",auth,(req,res)=>{
  const u=users.find(x=>x.id===req.user.id);
  res.json({id:u.id,username:u.username,role:u.role,balance:u.balance});
});

app.get("/api/stats",auth,role("owner","admin","reseller"),(req,res)=>{
  res.json({
    users:users.length,
    licenses:licenses.length,
    active:licenses.filter(x=>x.status==="active").length,
    expired:licenses.filter(x=>x.status==="expired").length
  });
});

app.post("/api/licenses/generate",auth,role("owner","admin","reseller"),(req,res)=>{
  const count=Math.max(1,Math.min(Number(req.body.count)||1,100));
  const days=Math.max(1,Number(req.body.days)||30);
  const custom=String(req.body.custom||"").trim();
  const created=[];
  for(let i=0;i<count;i++){
    const key=i===0 && custom ? custom : makeKey();
    if(licenses.some(x=>x.key===key)) continue;
    const item={
      id:licenses.length+1,key,days,status:"active",
      createdBy:req.user.username,createdAt:new Date().toISOString(),
      expiresAt:new Date(Date.now()+days*86400000).toISOString(),
      deviceId:null
    };
    licenses.push(item); created.push(item);
  }
  res.json({success:true,licenses:created});
});

app.get("/api/licenses",auth,role("owner","admin","reseller"),(req,res)=>{
  res.json(licenses.map(x=>({...x})));
});

app.post("/api/licenses/:id/extend",auth,role("owner","admin","reseller"),(req,res)=>{
  const l=licenses.find(x=>x.id===Number(req.params.id));
  if(!l) return res.status(404).json({error:"License not found"});
  const days=Math.max(1,Number(req.body.days)||30);
  const base=Math.max(Date.now(),new Date(l.expiresAt).getTime());
  l.expiresAt=new Date(base+days*86400000).toISOString();
  l.status="active";
  res.json(l);
});

app.post("/api/licenses/reset-all",auth,role("owner","admin"),(req,res)=>{
  licenses.forEach(l=>l.deviceId=null);
  res.json({success:true});
});

app.delete("/api/licenses/all",auth,role("owner"),(req,res)=>{
  licenses.length=0; res.json({success:true});
});

app.post("/api/users/:id/balance",auth,role("owner","admin"),(req,res)=>{
  const u=users.find(x=>x.id===Number(req.params.id));
  if(!u) return res.status(404).json({error:"User not found"});
  u.balance += Number(req.body.amount)||0;
  res.json({success:true,balance:u.balance});
});

app.delete("/api/users/:id",auth,role("owner","admin"),(req,res)=>{
  const idx=users.findIndex(x=>x.id===Number(req.params.id));
  if(idx<0) return res.status(404).json({error:"User not found"});
  if(users[idx].role==="owner") return res.status(400).json({error:"Owner cannot be deleted"});
  users.splice(idx,1); res.json({success:true});
});

/* APK license endpoint.
   Send {key,deviceId}. A valid key binds to the first device and
   subsequent checks must use that same device. */
app.post("/api/license/check",(req,res)=>{
  const {key,deviceId}=req.body;
  const l=licenses.find(x=>x.key===key);
  if(!l) return res.json({valid:false,reason:"invalid_key"});
  if(new Date(l.expiresAt).getTime()<=Date.now()){
    l.status="expired";
    return res.json({valid:false,reason:"expired"});
  }
  if(l.status!=="active") return res.json({valid:false,reason:l.status});
  if(!l.deviceId) l.deviceId=deviceId||null;
  if(l.deviceId && deviceId && l.deviceId!==deviceId)
    return res.json({valid:false,reason:"device_mismatch"});
  res.json({valid:true,key:l.key,expiresAt:l.expiresAt,deviceBound:!!l.deviceId});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`WE FEAR NONE running on port ${PORT}`));