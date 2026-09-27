import express from 'express';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const app=express(); app.use(helmet()); app.use(express.json({limit:'32kb'}));
const db=new Database(process.env.DB_PATH||'licenses.db'); db.pragma('journal_mode=WAL');
db.exec(`CREATE TABLE IF NOT EXISTS licenses(id INTEGER PRIMARY KEY AUTOINCREMENT,license TEXT UNIQUE NOT NULL,expires_at INTEGER NOT NULL,device_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);`);
const ADMIN_TOKEN=process.env.ADMIN_TOKEN;
function auth(req,res,next){if(!ADMIN_TOKEN||req.header('x-admin-token')!==ADMIN_TOKEN)return res.status(401).json({ok:false,error:'Unauthorized'});next()}
app.get('/',(_req,res)=>res.json({name:'DELTA.KEYS License Server',status:'online'}));
app.post('/api/license/verify',(req,res)=>{const {license,device_id}=req.body||{};if(!license||!device_id)return res.status(400).json({ok:false,error:'license and device_id are required'});const row=db.prepare('SELECT * FROM licenses WHERE license=?').get(String(license).trim());if(!row||!row.active)return res.status(401).json({ok:false,error:'Invalid license'});if(Date.now()>=row.expires_at)return res.status(401).json({ok:false,error:'License expired'});if(row.device_id&&row.device_id!==device_id)return res.status(409).json({ok:false,error:'License is already bound to another device'});if(!row.device_id)db.prepare('UPDATE licenses SET device_id=? WHERE id=?').run(device_id,row.id);res.json({ok:true,license:row.license,expires_at:row.expires_at})});
app.post('/api/admin/create',auth,(req,res)=>{const days=Number(req.body?.days);if(!Number.isInteger(days)||days<1||days>3650)return res.status(400).json({ok:false,error:'days must be 1..3650'});const license='DELTA-'+crypto.randomBytes(8).toString('hex').toUpperCase();const expires=Date.now()+days*86400000;db.prepare('INSERT INTO licenses(license,expires_at,created_at) VALUES(?,?,?)').run(license,expires,Date.now());res.json({ok:true,license,expires_at:expires})});
app.post('/api/admin/revoke',auth,(req,res)=>{const license=String(req.body?.license||'').trim();const result=db.prepare('UPDATE licenses SET active=0 WHERE license=?').run(license);res.json({ok:result.changes>0})});
app.post('/api/admin/unbind',auth,(req,res)=>{const license=String(req.body?.license||'').trim();const result=db.prepare('UPDATE licenses SET device_id=NULL WHERE license=?').run(license);res.json({ok:result.changes>0})});
app.get('/api/admin/licenses',auth,(_req,res)=>res.json(db.prepare('SELECT license,expires_at,device_id,active,created_at FROM licenses ORDER BY id DESC').all()));
const port=Number(process.env.PORT||3000);app.listen(port,'0.0.0.0',()=>console.log('License server listening on '+port));
