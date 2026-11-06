const path=require("path");
require("dotenv").config({
  // Local XAMPP variables must win over stale Windows/System variables.
  // Production Vercel environment variables remain authoritative.
  override: process.env.NODE_ENV !== "production",
});
const express=require("express");
const cors=require("cors");
const mysql=require("mysql2/promise");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const multer=require("multer");
const fs=require("fs");
const crypto=require("crypto");
const newsroomHandler=require('./newsroom');

const app=express();
app.set("trust proxy", 1);
const PORT=Number(process.env.PORT||5000);
const JWT_SECRET=process.env.JWT_SECRET;
const uploadDir=process.env.VERCEL ? '/tmp/shoto-point-uploads' : path.resolve(__dirname, process.env.UPLOAD_DIR||'uploads');
if(!process.env.VERCEL) fs.mkdirSync(uploadDir,{recursive:true});

const allowedOrigins=(process.env.CORS_ORIGIN||"").split(",").map(x=>x.trim()).filter(Boolean);
app.use(cors({origin:(origin,cb)=>{if(!origin||!allowedOrigins.length||allowedOrigins.includes(origin)) return cb(null,true); cb(new Error("Origin not allowed."));}}));
app.use("/api/payments/webhook", express.raw({type:"application/json", limit:"2mb"}));
app.use(express.json({limit:"10mb"}));
app.use(express.urlencoded({extended:true}));
app.use("/uploads",express.static(uploadDir));
// Ensure schema/database is ready before any API route touches MySQL.
app.use('/api',async(req,res,next)=>{
 // Keep the non-sensitive readiness endpoint available before database setup.
 // Apply database startup checks to API requests only, never to normal HTML/CSS/JS assets.
 if(req.method==='GET' && String(req.originalUrl||'').split('?')[0]==='/api/health/config') return next();
 try{await ensureStartup();next();}
 catch(e){
  console.error('SPP API initialisation failed:',e.message);
  res.status(503).json({success:false,error:'SPP API is not ready. Check JWT_SECRET and the MySQL environment settings.',details:process.env.NODE_ENV==='production'?undefined:e.message});
 }
});

const db=mysql.createPool({
 host:String(process.env.DB_HOST||"127.0.0.1").trim(),
 port:Number(process.env.DB_PORT||3306),
 user:String(process.env.DB_USER||"root").trim(),
 password:process.env.DB_PASSWORD||"",
 database:String(process.env.DB_NAME||"shoto_point").trim(),
 connectionLimit:10,
 waitForConnections:true,
 queueLimit:0,
 connectTimeout:15000,
ssl:String(process.env.DB_SSL||'false')==='true'
  ? {
      ca: fs.readFileSync(path.join(__dirname,'database','ca.pem'),'utf8'),
      rejectUnauthorized:true
    }
  : undefined,
 enableKeepAlive:true,
 keepAliveInitialDelay:10000,
 decimalNumbers:true
});
app.locals.sppDb=db;
// SPP_CMS_NEWSROOM_OVERRIDE: use MySQL-backed SPP Originals plus licensed external RSS feeds.
const sppCmsNewsroomHandler=require('./newsroom');
app.use('/api/public/newsroom',(req,res,next)=>{
 if(req.method!=='GET') return next();
 return sppCmsNewsroomHandler(req,res,next);
});
// SPP_CMS_SCHEDULE_TIMER: publish scheduled CMS blocks once their scheduled time arrives.
if (!global.SPP_CMS_SCHEDULE_TIMER) {
 global.SPP_CMS_SCHEDULE_TIMER=setInterval(()=>{
  db.query("UPDATE cms_content_blocks SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()").catch(()=>{});
 },30000);
 global.SPP_CMS_SCHEDULE_TIMER.unref?.();
}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:Number(process.env.MAX_UPLOAD_BYTES||(process.env.VERCEL?4*1024*1024:25*1024*1024))}});
const sourceUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024}});
const ALLOWED_MEDIA_MIME=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','application/pdf']);
function validateMediaType(mime){return ALLOWED_MEDIA_MIME.has(String(mime||'').toLowerCase());}

let _s3Client=null;
function getS3Client(){
 const account=process.env.R2_ACCOUNT_ID;
 const endpoint=process.env.S3_ENDPOINT || (account?`https://${account}.r2.cloudflarestorage.com`:null);
 if(!endpoint || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) return null;
 if(!_s3Client){
  const {S3Client}=require('@aws-sdk/client-s3');
  _s3Client=new S3Client({region:'auto',endpoint,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
 }
 return _s3Client;
}
function publicObjectUrl(key){
 const base=String(process.env.R2_PUBLIC_URL||'').replace(/\/$/,'');
 return base?`${base}/${key.split('/').map(encodeURIComponent).join('/')}`:null;
}
async function storeBuffer(buffer,originalName,mimeType,prefix='uploads'){
 const ext=path.extname(String(originalName||'')).toLowerCase().replace(/[^.a-z0-9]/g,'').slice(0,12)||'';
 const key=`${prefix}/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}${ext}`;
 const client=getS3Client();
 if(client){
  const {PutObjectCommand}=require('@aws-sdk/client-s3');
  await client.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:buffer,ContentType:mimeType||'application/octet-stream',CacheControl:'public, max-age=31536000, immutable'}));
  const url=publicObjectUrl(key);
  if(!url) throw new Error('R2_PUBLIC_URL is required so uploaded files can be served publicly.');
  return {key,url};
 }
 if(process.env.VERCEL) throw new Error('Persistent uploads are not configured. Add Cloudflare R2 credentials and R2_PUBLIC_URL before uploading on Vercel.');
 const localKey=key.replace(/\//g,path.sep);
 const absolute=path.join(uploadDir,localKey);
 fs.mkdirSync(path.dirname(absolute),{recursive:true});
 fs.writeFileSync(absolute,buffer);
 return {key:localKey,url:'/uploads/'+localKey.split(path.sep).map(encodeURIComponent).join('/')};
}
async function deleteStoredObject(key){
 const client=getS3Client();
 if(client){const {DeleteObjectCommand}=require('@aws-sdk/client-s3');await client.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));return;}
 if(!process.env.VERCEL){try{fs.unlinkSync(path.join(uploadDir,key));}catch(e){}}
}
async function presignUpload(key,mimeType){
 const client=getS3Client();
 if(!client) return null;
 const {PutObjectCommand}=require('@aws-sdk/client-s3');
 const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
 return getSignedUrl(client,new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,ContentType:mimeType||'application/octet-stream'}),{expiresIn:600});
}


function sign(admin){
 if(!JWT_SECRET) throw new Error('JWT_SECRET is not configured on the server.');
 return jwt.sign({id:admin.id,adminId:admin.admin_id,email:admin.email},JWT_SECRET,{expiresIn:'8h'});
}
function auth(req,res,next){
 if(!JWT_SECRET) return res.status(503).json({error:'Admin authentication is not configured. Set JWT_SECRET in the server environment.'});
 const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):'';
 try{req.admin=jwt.verify(token,JWT_SECRET);next();}catch(e){return res.status(401).json({error:'Authentication required.'});}
}
function id(){return crypto.randomUUID();}
async function activity(adminId,action,entityType=null,entityId=null,details=null){
 try{await db.execute("INSERT INTO admin_activity(admin_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)",[adminId,action,entityType,entityId,details?JSON.stringify(details):null]);}catch(e){}
}
function publicSettings(s){
 if(!s)return null;
 const x={...s};
 ["enabled","maintenance_mode","featured_enabled","breaking_enabled","auto_refresh_enabled","show_images","show_descriptions","show_sources","show_video_feed","show_local_news","show_visitor_news"].forEach(k=>x[k]=Boolean(x[k]));
 return x;
}

app.get("/api/health",async(req,res)=>{try{
 const [rows]=await db.query("SELECT 1 AS ok");
 res.json({ok:true,database:"connected",mysql:rows[0]?.ok===1,serverTime:new Date().toISOString()});
}catch(e){
 console.error('SPP health check failed:',e.code||e.name||'unknown');
 res.status(503).json({ok:false,error:'Database health check failed. Verify the configured database service and credentials.'});
}});
app.get("/api/health/config",async(req,res)=>{
 // Public diagnostics expose readiness flags only; never reveal database host, user or name.
 res.set('Cache-Control','no-store');
 res.json({
  ok:true,
  databaseConfigured:Boolean(process.env.DB_HOST&&process.env.DB_USER&&process.env.DB_NAME),
  authenticationConfigured:Boolean(JWT_SECRET),
  persistentStorageConfigured:Boolean(getS3Client()&&process.env.R2_PUBLIC_URL),
  providers:{
   openai:Boolean(process.env.OPENAI_API_KEY),
   gemini:Boolean(process.env.GEMINI_API_KEY),
   claude:Boolean(process.env.ANTHROPIC_API_KEY),
   kling:Boolean(process.env.KLING_ACCESS_KEY&&process.env.KLING_SECRET_KEY),
   yarngpt:Boolean(process.env.YARNGPT_API_KEY)
  },
  runtime:process.env.VERCEL?'vercel':'node'
 });
});

app.post("/api/admin/register",async(req,res)=>{
 if(String(process.env.ADMIN_REGISTRATION_ENABLED||'false')!=='true') return res.status(403).json({error:'Public admin registration is disabled. Use scripts/create-admin.cjs to provision an administrator securely.'});
 const supplied=String(req.headers['x-spp-admin-setup']||'');
 const expected=String(process.env.ADMIN_SETUP_SECRET||'');
 if(!expected || supplied.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return res.status(403).json({error:'A valid server-side setup secret is required.'});
 try{
  const {firstName,lastName,email,phone,password,confirmPassword}=req.body;
  if(!firstName||!lastName||!email||!phone||!password||password!==confirmPassword)return res.status(400).json({error:"Complete the form and make sure passwords match."});
  const adminId="SP-ADMIN-"+crypto.randomBytes(3).toString("hex").toUpperCase();
  const controlKey="SPK-"+crypto.randomBytes(8).toString("hex").toUpperCase();
  const hash=await bcrypt.hash(password,12);
  const [r]=await db.execute("INSERT INTO admins(admin_id,control_key,first_name,last_name,email,phone,password_hash) VALUES(?,?,?,?,?,?,?)",[adminId,controlKey,firstName,lastName,email,phone,hash]);
  res.json({success:true,credentials:{adminId,controlKey},id:r.insertId});
 }catch(e){res.status(400).json({error:e.code==="ER_DUP_ENTRY"?"An admin with that email already exists.":e.message});}
});

app.post("/api/admin/login",async(req,res)=>{
 try{
  const {adminId,password,controlKey}=req.body;
  const [rows]=await db.execute("SELECT * FROM admins WHERE admin_id=? AND control_key=? LIMIT 1",[adminId,controlKey]);
  const a=rows[0];
  if(!a||a.status!=="active"||!(await bcrypt.compare(password,a.password_hash)))return res.status(401).json({error:"Invalid admin credentials."});
  await activity(a.id,"login","admin",String(a.id));
  res.json({success:true,token:sign(a),profile:{id:a.id,adminId:a.admin_id,firstName:a.first_name,lastName:a.last_name,email:a.email}});
 }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/admin/dashboard",auth,async(req,res)=>{
 try{
  const [[content]]=await db.query("SELECT COUNT(*) content FROM content_items WHERE status='published'");
  const [[meetings]]=await db.query("SELECT COUNT(*) meetings FROM meeting_registrations");
  const [[orders]]=await db.query("SELECT COUNT(*) orders FROM orders");
  const [[revenue]]=await db.query("SELECT COALESCE(SUM(amount),0) revenue FROM transactions WHERE LOWER(status) IN ('success','successful','paid')");
  const [[pendingNews]]=await db.query("SELECT COUNT(*) pendingNews FROM news_submissions WHERE status='pending'");
  const [[visitors]]=await db.query("SELECT COUNT(*) visitors FROM website_analytics WHERE created_at>=NOW()-INTERVAL 30 DAY");
  res.json({success:true,data:{content:content.content,meetings:meetings.meetings,orders:orders.orders,revenue:Number(revenue.revenue),pendingNews:pendingNews.pendingNews,visitors:visitors.visitors}});
 }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/admin/newsfeed-settings",auth,async(req,res)=>{
 const [rows]=await db.query("SELECT * FROM newsfeed_settings WHERE id=1");
 res.json({success:true,data:publicSettings(rows[0])});
});
app.put("/api/admin/newsfeed-settings",auth,async(req,res)=>{
 try{
  const allowed=["enabled","maintenance_mode","stories_per_feed","featured_enabled","breaking_enabled","breaking_text","breaking_link","auto_refresh_enabled","auto_refresh_seconds","sort_order","layout","show_images","show_descriptions","show_sources","show_video_feed","show_local_news","show_visitor_news"];
  const b=req.body;
  const set=allowed.filter(k=>Object.prototype.hasOwnProperty.call(b,k));
  if(!set.length)return res.status(400).json({error:"No settings supplied."});
  const vals=set.map(k=>b[k]);
  const sql=`UPDATE newsfeed_settings SET ${set.map(k=>`${k}=?`).join(",")},updated_by=? WHERE id=1`;
  await db.execute(sql,[...vals,req.admin.id]);
  await activity(req.admin.id,"update","newsfeed_settings","1",b);
  const [rows]=await db.query("SELECT * FROM newsfeed_settings WHERE id=1");
  res.json({success:true,data:publicSettings(rows[0])});
 }catch(e){res.status(400).json({error:e.message});}
});


// Public RSS newsroom endpoint. The Vercel serverless adapter at
// api/public/newsroom.js calls the same handler; local Express must mount it too.
app.get('/api/public/newsroom', (req,res,next)=>{
  Promise.resolve(newsroomHandler(req,res)).catch(next);
});
// Backwards-compatible alias for clients configured to use /api/newsroom.
app.get('/api/newsroom', (req,res,next)=>{
  Promise.resolve(newsroomHandler(req,res)).catch(next);
});

app.get("/api/public/newsroom-config",async(req,res)=>{
 const [[s]]=await db.query("SELECT * FROM newsfeed_settings WHERE id=1");
 const [cats]=await db.query("SELECT slug,name,description,display_order FROM newsroom_categories WHERE enabled=1 ORDER BY display_order,name");
 const [featured]=await db.query("SELECT id,title,description,image_url,external_url,category,position FROM newsroom_featured WHERE status='published' ORDER BY position,id DESC LIMIT 20");
 res.json({success:true,data:{settings:publicSettings(s),categories,featured}});
});

app.get("/api/admin/categories",auth,async(req,res)=>{
 const [rows]=await db.query("SELECT * FROM newsroom_categories ORDER BY display_order,name");res.json({success:true,data:rows});
});
app.post("/api/admin/categories",auth,async(req,res)=>{
 const {slug,name,description,enabled=true,display_order=0}=req.body;
 if(!slug||!name)return res.status(400).json({error:"Category name and slug are required."});
 try{const [r]=await db.execute("INSERT INTO newsroom_categories(slug,name,description,enabled,display_order) VALUES(?,?,?,?,?)",[slug,name,description||null,enabled?1:0,Number(display_order)||0]);await activity(req.admin.id,"create","category",String(r.insertId),req.body);res.json({success:true,id:r.insertId});}catch(e){res.status(400).json({error:e.message});}
});
app.put("/api/admin/categories/:id",auth,async(req,res)=>{
 const {name,description,enabled,display_order}=req.body;
 await db.execute("UPDATE newsroom_categories SET name=COALESCE(?,name),description=?,enabled=COALESCE(?,enabled),display_order=COALESCE(?,display_order) WHERE id=?",[name||null,description??null,enabled===undefined?null:(enabled?1:0),display_order===undefined?null:Number(display_order),req.params.id]);
 await activity(req.admin.id,"update","category",req.params.id,req.body);res.json({success:true});
});
app.delete("/api/admin/categories/:id",auth,async(req,res)=>{await db.execute("DELETE FROM newsroom_categories WHERE id=?",[req.params.id]);await activity(req.admin.id,"delete","category",req.params.id);res.json({success:true});});

app.get("/api/admin/news",auth,async(req,res)=>{
 const [rows]=await db.query("SELECT * FROM news_submissions ORDER BY FIELD(status,'pending','approved','rejected'),created_at DESC");res.json({success:true,data:rows});
});
app.post("/api/admin/news/:action",auth,async(req,res)=>{
 const action=req.params.action,id=req.body.id;
 if(!["approve","reject","delete"].includes(action))return res.status(400).json({error:"Invalid action."});
 if(action==="delete"){await db.execute("DELETE FROM news_submissions WHERE id=?",[id]);}
 else {await db.execute("UPDATE news_submissions SET status=?,approved_by=?,published_at=? WHERE id=?", [action==="approve"?"approved":"rejected",action==="approve"?req.admin.id:null,action==="approve"?new Date():null,id]);}
 await activity(req.admin.id,action,"news_submission",String(id));res.json({success:true});
});


/* =========================================================
   TEAM MANAGEMENT
   ========================================================= */

async function ensureTeamTable(){
 try{
  await db.query(`
   CREATE TABLE IF NOT EXISTS team_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_key VARCHAR(40) NOT NULL,
    role VARCHAR(180) NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_bio TEXT,
    biography LONGTEXT,
    image_url VARCHAR(2000),
    whatsapp_url VARCHAR(2000) NULL,
    social_json JSON NULL,
    show_social TINYINT(1) NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_team_group_active_order(group_key,active,display_order),
    CONSTRAINT fk_team_created_by FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
   )
  `);
  // Safe migrations for databases created by earlier Shoto Point packages.
  for (const ddl of [
    "ALTER TABLE team_members ADD COLUMN whatsapp_url VARCHAR(2000) NULL",
    "ALTER TABLE team_members ADD COLUMN social_json JSON NULL",
    "ALTER TABLE team_members ADD COLUMN show_social TINYINT(1) NOT NULL DEFAULT 0"
  ]) { try { await db.query(ddl); } catch (e) { if (!["ER_DUP_FIELDNAME","ER_DUP_COLUMN"].includes(e.code)) throw e; } }
  await db.query("UPDATE team_members SET show_social=0, whatsapp_url=NULL, social_json=NULL WHERE LOWER(name) NOT LIKE '%deevinitee%'");
  // Remove only unmistakable placeholder profiles from older demo installations.
  // Real team records, including administrator-entered names, are preserved.
  await db.execute("DELETE FROM team_members WHERE name IN ('CEO Name','Co-Founder Name','Creative Producer','Director of Photography','Sound Lead','Talent Coordinator','Senior Team Member Five')");
 }catch(e){
  console.error("Team table check failed:",e.message);
 }
}

app.get("/api/public/team",async(req,res)=>{
 try{
  const allowed=["ceo","administrative","senior"];
  const group=String(req.query.group||"").trim().toLowerCase();
  const memberId=req.query.id ? Number(req.query.id) : null;
  if(group && !allowed.includes(group))return res.status(400).json({error:"Invalid team group."});
  if(req.query.id && !Number.isInteger(memberId))return res.status(400).json({error:"Invalid team member id."});
  const where=[]; const params=[];
  where.push("active=1");
  if(group){where.push("group_key=?");params.push(group);}
  if(memberId){where.push("id=?");params.push(memberId);}
  const [rows]=await db.query(
   `SELECT id,group_key,role,name,short_bio,biography,image_url,whatsapp_url,social_json,show_social,display_order
    FROM team_members
    WHERE ${where.join(" AND ")}
    ORDER BY group_key,display_order,id`, params
  );
  res.json({success:true,data:rows});
 }catch(e){
  res.status(500).json({error:e.message});
 }
});

app.get("/api/admin/team",auth,async(req,res)=>{
 try{
  const [rows]=await db.query(
   "SELECT * FROM team_members ORDER BY group_key,display_order,id"
  );
  res.json({success:true,data:rows});
 }catch(e){
  res.status(500).json({error:e.message});
 }
});

app.post("/api/admin/team",auth,async(req,res)=>{
 try{
  const b=req.body||{};
  const groups=["ceo","administrative","senior"];
  if(!groups.includes(String(b.group_key||"")))return res.status(400).json({error:"Select a valid team group."});
  if(!String(b.role||"").trim()||!String(b.name||"").trim())return res.status(400).json({error:"Role and name are required."});
  const [r]=await db.execute(
   `INSERT INTO team_members
    (group_key,role,name,short_bio,biography,image_url,whatsapp_url,social_json,show_social,display_order,active,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
   [
    b.group_key,String(b.role).trim(),String(b.name).trim(),
    b.short_bio||null,b.biography||null,b.image_url||null,
    (b.whatsapp_url||null),
    (b.social_json ? JSON.stringify(b.social_json) : null),
    b.show_social ? 1 : 0,
    Number.isFinite(Number(b.display_order))?Number(b.display_order):0,
    b.active===false||String(b.active)==="0"?0:1,
    req.admin.id
   ]
  );
  await activity(req.admin.id,"create","team_member",String(r.insertId),b);
  res.json({success:true,id:r.insertId});
 }catch(e){
  res.status(400).json({error:e.message});
 }
});

app.put("/api/admin/team/:id",auth,async(req,res)=>{
 try{
  const b=req.body||{};
  const groups=["ceo","administrative","senior"];
  if(b.group_key!==undefined&&!groups.includes(String(b.group_key)))return res.status(400).json({error:"Invalid team group."});
  await db.execute(
   `UPDATE team_members SET
    group_key=COALESCE(?,group_key),
    role=COALESCE(?,role),
    name=COALESCE(?,name),
    short_bio=?,
    biography=?,
    image_url=?,
    whatsapp_url=?,
    social_json=?,
    show_social=?,
    display_order=COALESCE(?,display_order),
    active=COALESCE(?,active)
    WHERE id=?`,
   [
    b.group_key||null,b.role||null,b.name||null,
    b.short_bio??null,b.biography??null,b.image_url??null,
    (b.whatsapp_url||null),
    (b.social_json ? JSON.stringify(b.social_json) : null),
    b.show_social ? 1 : 0,
    b.display_order===undefined?null:Number(b.display_order),
    b.active===undefined?null:(b.active?1:0),
    req.params.id
   ]
  );
  await activity(req.admin.id,"update","team_member",req.params.id,b);
  res.json({success:true});
 }catch(e){
  res.status(400).json({error:e.message});
 }
});

app.delete("/api/admin/team/:id",auth,async(req,res)=>{
 try{
  await db.execute("DELETE FROM team_members WHERE id=?",[req.params.id]);
  await activity(req.admin.id,"delete","team_member",req.params.id);
  res.json({success:true});
 }catch(e){
  res.status(400).json({error:e.message});
 }
});

app.post("/api/admin/content",auth,async(req,res)=>{
 try{
  const {section,contentType,title,description,body,mediaUrl,downloadUrl,amount=0,status="draft",scheduledAt}=req.body;
  if(!section||!title)return res.status(400).json({error:"Section and title are required."});
  const [r]=await db.execute("INSERT INTO content_items(section,content_type,title,description,body,media_url,download_url,amount,status,scheduled_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",[section,contentType||"writeup",title,description||null,body||null,mediaUrl||null,downloadUrl||null,Number(amount)||0,status,scheduledAt||null,req.admin.id]);
  await activity(req.admin.id,"create","content",String(r.insertId),req.body);res.json({success:true,id:r.insertId});
 }catch(e){res.status(400).json({error:e.message});}
});
app.get("/api/admin/content",auth,async(req,res)=>{const [rows]=await db.query("SELECT * FROM content_items ORDER BY updated_at DESC");res.json({success:true,data:rows});});
app.put("/api/admin/content/:id",auth,async(req,res)=>{
 const b=req.body;
 await db.execute("UPDATE content_items SET section=COALESCE(?,section),content_type=COALESCE(?,content_type),title=COALESCE(?,title),description=?,body=?,media_url=?,download_url=?,amount=COALESCE(?,amount),status=COALESCE(?,status),scheduled_at=? WHERE id=?",[b.section||null,b.contentType||null,b.title||null,b.description??null,b.body??null,b.mediaUrl??null,b.downloadUrl??null,b.amount===undefined?null:Number(b.amount),b.status||null,b.scheduledAt||null,req.params.id]);
 await activity(req.admin.id,"update","content",req.params.id,b);res.json({success:true});
});

app.get("/api/content",async(req,res)=>{
 const section=req.query.section;
 const [rows]=await db.execute("SELECT id,section,content_type,title,description,body,media_url,download_url,amount,status,scheduled_at FROM content_items WHERE status='published' AND (? IS NULL OR section=?) ORDER BY created_at DESC",[section||null,section||null]);
 res.json({success:true,data:rows});
});

app.get("/api/admin/customers",auth,async(req,res)=>{const [rows]=await db.query("SELECT id,email,username,first_name,last_name,phone,status,created_at FROM customers ORDER BY created_at DESC");res.json({success:true,data:rows});});
app.post("/api/admin/customers/:id/:action",auth,async(req,res)=>{const action=req.params.action;if(!["approve","reject"].includes(action))return res.status(400).json({error:"Invalid action."});await db.execute("UPDATE customers SET status=? WHERE id=?",[action==="approve"?"approved":"rejected",req.params.id]);await activity(req.admin.id,action,"customer",req.params.id);res.json({success:true});});


app.get('/api/admin/registrations',auth,async(req,res)=>{try{const [rows]=await db.query('SELECT id,reference,email,status,payload_json,created_at FROM production_registrations ORDER BY created_at DESC LIMIT 500');res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/public-contacts',auth,async(req,res)=>{try{const [rows]=await db.query('SELECT * FROM public_contacts ORDER BY created_at DESC LIMIT 500');res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
// One membership queue for both public portals. Prefixing the row ID keeps an
// approval action tied to the correct table even when numeric IDs overlap.
app.get('/api/admin/syfm-memberships',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT CONCAT('SYFM:',id) AS id, application_id,full_name,email,phone,status,created_at,'SYFM' AS portal FROM syfm_memberships UNION ALL SELECT CONCAT('SPN:',id) AS id, application_id,full_name,email,phone,status,created_at,'Shoto Point News' AS portal FROM shoto_news_memberships ORDER BY created_at DESC LIMIT 500");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/shoto-point-news-memberships',auth,async(req,res)=>{try{const [rows]=await db.query('SELECT * FROM shoto_news_memberships ORDER BY created_at DESC LIMIT 500');res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/syfm-contacts',auth,async(req,res)=>{try{const [rows]=await db.query('SELECT * FROM syfm_contacts ORDER BY created_at DESC LIMIT 500');res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.patch('/api/admin/registrations/:id',auth,async(req,res)=>{try{const status=['pending','approved','rejected'].includes(req.body.status)?req.body.status:'pending';await db.execute('UPDATE production_registrations SET status=? WHERE id=?',[status,req.params.id]);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.patch('/api/admin/syfm-memberships/:id',auth,async(req,res)=>{try{const status=['pending','approved','rejected'].includes(req.body.status)?req.body.status:'pending';const [portal,rawId]=String(req.params.id).split(':');const table=portal==='SPN'?'shoto_news_memberships':'syfm_memberships';await db.execute(`UPDATE ${table} SET status=? WHERE id=?`,[status,rawId||req.params.id]);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.patch('/api/admin/shoto-point-news-memberships/:id',auth,async(req,res)=>{try{const status=['pending','approved','rejected'].includes(req.body.status)?req.body.status:'pending';await db.execute('UPDATE shoto_news_memberships SET status=? WHERE id=?',[status,req.params.id]);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get("/api/admin/meetings",auth,async(req,res)=>{const [rows]=await db.query("SELECT * FROM meeting_registrations ORDER BY created_at DESC");res.json({success:true,data:rows});});
app.post("/api/admin/meetings/:id/status",auth,async(req,res)=>{const allowed=["pending","approved","rejected","rescheduled","completed"];if(!allowed.includes(req.body.status))return res.status(400).json({error:"Invalid meeting status."});await db.execute("UPDATE meeting_registrations SET status=?,meeting_at=?,notes=? WHERE id=?",[req.body.status,req.body.meetingAt||null,req.body.notes||null,req.params.id]);await activity(req.admin.id,"update","meeting",req.params.id,req.body);res.json({success:true});});

app.get("/api/admin/transactions",auth,async(req,res)=>{const [rows]=await db.query("SELECT id,reference,amount,status,created_at FROM transactions ORDER BY created_at DESC LIMIT 500");res.json({success:true,data:rows});});
app.get("/api/admin/orders",auth,async(req,res)=>{const [rows]=await db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500");res.json({success:true,data:rows});});

app.get("/api/admin/analytics",auth,async(req,res)=>{
 const [daily]=await db.query("SELECT DATE(created_at) day,COUNT(*) visits FROM website_analytics WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY DATE(created_at) ORDER BY day");
 const [pages]=await db.query("SELECT path,COUNT(*) visits FROM website_analytics WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY path ORDER BY visits DESC LIMIT 20");
 res.json({success:true,data:{daily,pages}});
});
app.post("/api/public/track",async(req,res)=>{
 const pathValue=String(req.body.path||"/").slice(0,2000);
 const ref=String(req.body.referrer||"").slice(0,2000);
 const ua=String(req.headers["user-agent"]||"").slice(0,1000);
 const visitorHash=crypto.createHash("sha256").update((req.ip||"")+"|"+ua).digest("hex");
 await db.execute("INSERT INTO website_analytics(path,referrer,visitor_hash,user_agent) VALUES(?,?,?,?)",[pathValue,ref,visitorHash,ua]);
 res.json({success:true});
});

app.get("/api/admin/seo",auth,async(req,res)=>{const [[s]]=await db.query("SELECT * FROM seo_settings WHERE id=1");res.json({success:true,data:s});});
app.put("/api/admin/seo",auth,async(req,res)=>{
 const b=req.body;await db.execute("UPDATE seo_settings SET site_title=?,meta_description=?,canonical_url=?,robots_index=?,sitemap_enabled=?,news_schema_enabled=?,updated_by=? WHERE id=1",[b.site_title||"",b.meta_description||"",b.canonical_url||"",b.robots_index?1:0,b.sitemap_enabled?1:0,b.news_schema_enabled?1:0,req.admin.id]);await activity(req.admin.id,"update","seo","1",b);res.json({success:true});
});

app.post('/api/admin/upload',auth,upload.single('file'),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({error:'No file uploaded.'});
  const stored=await storeBuffer(req.file.buffer,req.file.originalname,req.file.mimetype,'uploads');
  await activity(req.admin.id,'upload','media',stored.key,{originalName:req.file.originalname,mime:req.file.mimetype});
  res.json({success:true,url:stored.url,storageKey:stored.key,originalName:req.file.originalname,mime:req.file.mimetype});
 }catch(e){res.status(400).json({error:e.message});}
});


/* ================================================================
   PUBLIC PRODUCTION WORKFLOWS
   Registrations, contacts, SYFM, visitor news and Paystack.
   ================================================================ */
function clean(v,max=5000){ return String(v ?? '').trim().slice(0,max); }
function jsonBody(req){ return req.body && typeof req.body === 'object' ? req.body : {}; }

async function ensureProductionTables(){
  const statements=[
`CREATE TABLE IF NOT EXISTS production_registrations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, reference VARCHAR(80) NOT NULL UNIQUE,
 payload_json JSON NOT NULL, email VARCHAR(255) NULL, status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(status), INDEX(email), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS public_contacts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, form_type VARCHAR(60) NOT NULL DEFAULT 'website',
 name VARCHAR(180) NULL, email VARCHAR(255) NULL, phone VARCHAR(60) NULL, subject VARCHAR(255) NULL,
 message TEXT NOT NULL, payload_json JSON NULL, status ENUM('new','read','closed') NOT NULL DEFAULT 'new',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(status), INDEX(form_type), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS syfm_memberships (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, application_id VARCHAR(80) NOT NULL UNIQUE,
 full_name VARCHAR(255) NULL, email VARCHAR(255) NULL, phone VARCHAR(60) NULL, payload_json JSON NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(status), INDEX(email), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS shoto_news_memberships (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, application_id VARCHAR(80) NOT NULL UNIQUE, full_name VARCHAR(255) NULL, email VARCHAR(255) NULL, phone VARCHAR(60) NULL, payload_json JSON NOT NULL, status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(status), INDEX(email), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS syfm_contacts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(180) NULL, email VARCHAR(255) NULL,
 subject VARCHAR(255) NULL, message TEXT NOT NULL, payload_json JSON NULL, status ENUM('new','read','closed') NOT NULL DEFAULT 'new',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(status), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS paystack_webhook_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id VARCHAR(255) NULL UNIQUE, event_name VARCHAR(120) NOT NULL,
 payload_json JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(event_name), INDEX(created_at)
) ENGINE=InnoDB`
  ];
  for(const sql of statements) await db.query(sql);
}

app.post('/api/public/registrations',async(req,res)=>{
 try{
  const b=jsonBody(req); const payload={...b};
  const email=clean(b.email||b['Email']||b['Email Address'],255)||null;
  const ref='SP-REG-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  await db.execute('INSERT INTO production_registrations(reference,payload_json,email) VALUES(?,?,?)',[ref,JSON.stringify(payload),email]);
  res.status(201).json({success:true,reference:ref,message:'Registration submitted successfully.'});
 }catch(e){res.status(500).json({success:false,error:'Unable to save registration.'});}
});

app.post('/api/public/contact',async(req,res)=>{
 try{
  const b=jsonBody(req); const message=clean(b.message||b.Message,10000); if(!message) return res.status(400).json({error:'Message is required.'});
  await db.execute('INSERT INTO public_contacts(form_type,name,email,phone,subject,message,payload_json) VALUES(?,?,?,?,?,?,?)',[clean(b.formType||'website',60),clean(b.name||b.Name,180)||null,clean(b.email||b.Email,255)||null,clean(b.phone||b.Phone,60)||null,clean(b.subject||b.Subject,255)||null,message,JSON.stringify(b)]);
  res.status(201).json({success:true,message:'Message received successfully.'});
 }catch(e){res.status(500).json({success:false,error:'Unable to save your message.'});}
});

// Membership registrations from the SYFM and Shoto Point News portals.
// Passport images are accepted as multipart uploads and stored in the JSON payload;
// for long-term scale, configure object storage and migrate these data URLs to R2.
async function saveMembership(req,res,brand){
 try{
  const b={...(req.body||{})};
  if(req.file){const mime=req.file.mimetype||'image/jpeg'; if(!/^image\/(jpeg|png|webp)$/.test(mime)) return res.status(415).json({success:false,error:'Passport must be JPG, PNG or WEBP.'}); b.passport='data:'+mime+';base64,'+req.file.buffer.toString('base64');}
  const fullName=clean([b.firstName,b.middleName,b.lastName].filter(Boolean).join(' ')||b.fullName||b.full_name,255)||null;
  const email=clean(b.email||b['Email Address'],255)||null;
  const phone=clean(b.phone||b['Phone Number'],60)||null;
  if(!fullName||!email) return res.status(400).json({success:false,error:'Full name and email address are required.'});
  const applicationId=brand+'-'+new Date().getFullYear()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();
  b.applicationId=applicationId; b.brand=brand; b.status='pending'; b.submittedAt=new Date().toISOString();
  const table=brand==='SYFM'?'syfm_memberships':'shoto_news_memberships';
  await db.execute(`INSERT INTO ${table}(application_id,full_name,email,phone,payload_json) VALUES(?,?,?,?,?)`,[applicationId,fullName,email,phone,JSON.stringify(b)]);
  return res.status(201).json({success:true,applicationId,memberCode:applicationId,reference:applicationId,status:'RECEIVED — AWAITING MEMBERSHIP REVIEW',message:'Registration saved successfully.'});
 }catch(e){console.error(brand+' membership registration failed:',e);return res.status(500).json({success:false,error:'Unable to save registration. Please try again.'});}
}
// The public forms submit the file as "passportPhoto".  Accept the former
// "passport" field too so registrations from an older downloaded portal do
// not fail with Multer's "Unexpected field" error.
const membershipPassportUpload=upload.fields([{name:'passportPhoto',maxCount:1},{name:'passport',maxCount:1}]);
function withMembershipPassport(brand){return (req,res)=>{
  const files=req.files||{};
  req.file=(files.passportPhoto&&files.passportPhoto[0])||(files.passport&&files.passport[0])||null;
  return saveMembership(req,res,brand);
};}
app.post('/api/public/membership/register',membershipPassportUpload,withMembershipPassport('SYFM'));
app.post('/api/public/syfm/membership/register',membershipPassportUpload,withMembershipPassport('SYFM'));
app.post('/api/public/shoto-point-news/membership/register',membershipPassportUpload,withMembershipPassport('SPN'));

app.post('/api/public/syfm/membership',async(req,res)=>{
 try{
  const b=jsonBody(req); const fullName=clean(b.full_name||b.fullName||b.name||b['Full Name'],255)||null; const email=clean(b.email||b['Email Address'],255)||null;
  if(!email) return res.status(400).json({error:'Email address is required.'});
  const applicationId='SYFM-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  await db.execute('INSERT INTO syfm_memberships(application_id,full_name,email,phone,payload_json) VALUES(?,?,?,?,?)',[applicationId,fullName,email,clean(b.phone||b['Phone Number'],60)||null,JSON.stringify(b)]);
  res.status(201).json({success:true,applicationId,message:'Your SYFM membership application has been submitted.'});
 }catch(e){res.status(500).json({success:false,error:'Unable to save your membership application.'});}
});

app.post('/api/public/syfm/contact',async(req,res)=>{
 try{
  const b=jsonBody(req); const message=clean(b.message||b.Message,10000); if(!message) return res.status(400).json({error:'Message is required.'});
  await db.execute('INSERT INTO syfm_contacts(name,email,subject,message,payload_json) VALUES(?,?,?,?,?)',[clean(b.name||b.Name,180)||null,clean(b.email||b.Email,255)||null,clean(b.subject||b.Subject,255)||null,message,JSON.stringify(b)]);
  res.status(201).json({success:true,message:'SYFM message received successfully.'});
 }catch(e){res.status(500).json({success:false,error:'Unable to save your message.'});}
});

app.post('/api/public/news',async(req,res)=>{
 try{
  const b=jsonBody(req); const title=clean(b.title,255); const content=clean(b.content||b.body||b.summary,100000); if(!title||!content) return res.status(400).json({error:'Headline and article content are required.'});
  const id=crypto.randomUUID();
  await db.execute('INSERT INTO news_submissions(id,title,content,type,category,source,region,external_url,submitted_by,submitter_email,status) VALUES(?,?,?,?,?,?,?,?,?,?,\'pending\')',[id,title,content,clean(b.type||'visitor',80),clean(b.category,80)||null,clean(b.source||b.sourceUrl,255)||null,clean(b.region,120)||null,clean(b.external_url||b.sourceUrl,2000)||null,clean(b.authorName||b.name,120)||null,clean(b.authorEmail||b.email,255)||null]);
  res.status(201).json({success:true,submissionId:id,message:'News submission received and queued for review.'});
 }catch(e){res.status(500).json({success:false,error:'Unable to save news submission.'});}
});

app.get('/api/payments/item/:itemType/:itemId',async(req,res)=>{
 try{
  const id=Number(req.params.itemId); if(!Number.isInteger(id)) return res.status(400).json({error:'Invalid item ID.'});
  const [[item]]=await db.query("SELECT id,title,description,amount,status,content_type AS item_type FROM content_items WHERE id=? AND status='published' LIMIT 1",[id]);
  if(!item) return res.status(404).json({error:'Published item not found.'});
  res.json({success:true,data:{itemId:item.id,itemType:req.params.itemType,title:item.title,description:item.description,amount:Number(item.amount||0),contentType:item.item_type}});
 }catch(e){res.status(500).json({error:'Unable to load checkout item.'});}
});

app.post('/api/payments/initialize',async(req,res)=>{
 try{
  const b=jsonBody(req); const email=clean(b.email,255); const itemId=Number(b.itemId); const itemType=clean(b.itemType,80); const channel=clean(b.channel,30)||null;
  if(!email||!Number.isInteger(itemId)||!itemType) return res.status(400).json({error:'Email, item type and item are required.'});
  const [[item]]=await db.query("SELECT id,title,amount FROM content_items WHERE id=? AND status='published' LIMIT 1",[itemId]);
  if(!item) return res.status(404).json({error:'Published item not found.'});
  const amount=Math.round(Number(item.amount)*100); if(!(amount>0)) return res.status(400).json({error:'This item does not have a valid price.'});
  if(!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({error:'Paystack is not configured for this deployment.'});
  const reference='SP-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
  await db.execute('INSERT INTO orders(reference,email,item_id,item_type,amount,status,channel) VALUES(?,?,?,?,?,?,?)',[reference,email,itemId,itemType,amount/100,'pending',channel]);
  const r=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount,reference,callback_url:`${process.env.PUBLIC_URL||''}/payment-callback.php?reference=${encodeURIComponent(reference)}`,metadata:{itemId,itemType,channel}})});
  const d=await r.json(); if(!r.ok||!d.status) { await db.execute('UPDATE orders SET status=\'failed\' WHERE reference=?',[reference]); return res.status(502).json({error:d.message||'Paystack initialization failed.'}); }
  res.json({success:true,reference,authorizationUrl:d.data.authorization_url,accessCode:d.data.access_code});
 }catch(e){res.status(500).json({error:'Unable to initialize payment.'});}
});

app.get('/api/payments/verify/:reference',async(req,res)=>{
 try{
  if(!process.env.PAYSTACK_SECRET_KEY) return res.status(503).json({error:'Paystack is not configured.'});
  const reference=clean(req.params.reference,100); const r=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`}}); const d=await r.json();
  if(!r.ok||!d.status) return res.status(502).json({error:d.message||'Paystack verification failed.'});
  const status=d.data.status==='success'?'paid':'failed'; await db.execute('UPDATE orders SET status=? WHERE reference=?',[status,reference]); await db.execute('INSERT INTO transactions(reference,amount,status,payload) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE amount=VALUES(amount),status=VALUES(status),payload=VALUES(payload)',[reference,Number(d.data.amount||0)/100,status,JSON.stringify(d.data)]);
  res.json({success:true,status,reference,amount:Number(d.data.amount||0)/100,data:d.data});
 }catch(e){res.status(500).json({error:'Unable to verify payment.'});}
});

app.post('/api/payments/webhook',async(req,res)=>{
 try{
  const signature=String(req.headers['x-paystack-signature']||''); const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(JSON.stringify(req.body||{}));
  const expected=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY||'').update(raw).digest('hex');
  if(!signature||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return res.status(401).send('invalid signature');
  const b=JSON.parse(raw.toString('utf8')||'{}'); const eventId=b.id?String(b.id):crypto.createHash('sha256').update(raw).digest('hex');
  await db.execute('INSERT IGNORE INTO paystack_webhook_events(event_id,event_name,payload_json) VALUES(?,?,?)',[eventId,clean(b.event||'unknown',120),raw.toString('utf8')]);
  if(b.event==='charge.success'&&b.data?.reference){await db.execute('UPDATE orders SET status=\'paid\' WHERE reference=?',[b.data.reference]);await db.execute('INSERT INTO transactions(reference,amount,status,payload) VALUES(?,?,\'paid\',?) ON DUPLICATE KEY UPDATE amount=VALUES(amount),status=\'paid\',payload=VALUES(payload)',[b.data.reference,Number(b.data.amount||0)/100,raw.toString('utf8')]);}
  res.send('ok');
 }catch(e){res.status(500).send('error');}
});


/* ================================================================
   SPP AI CREATIVE STUDIO â€” SERVER-SIDE PROVIDER GATEWAY
   Secrets remain in server environment variables. ChatGPT uses the
   OpenAI API credential; Google Flow is an import workflow; ShotoAI
   remains reserved until its own engine is developed.
   ================================================================ */
function aiProviderState(){
 const has=k=>Boolean(String(process.env[k]||'').trim());
 return [
  {id:'openai',name:'OpenAI Image & Text',configured:has('OPENAI_API_KEY'),tasks:['image','text'],note:'GPT Image + text generation'},
  {id:'chatgpt',name:'ChatGPT',configured:has('OPENAI_API_KEY'),tasks:['text'],note:'Uses the same OpenAI API key; not a separate API credential'},
  {id:'gemini',name:'Google Gemini',configured:has('GEMINI_API_KEY'),tasks:['image','video','text'],note:'Gemini API; selected endpoints/models must be enabled'},
  {id:'claude',name:'Claude',configured:has('ANTHROPIC_API_KEY'),tasks:['text'],note:'Scripts, concepts, shot lists and creative direction'},
  {id:'kling',name:'Kling AI',configured:has('KLING_ACCESS_KEY')&&has('KLING_SECRET_KEY'),tasks:['video'],note:'Kling developer API credentials'},
  {id:'yarngpt',name:'YarnGPT',configured:has('YARNGPT_API_KEY'),tasks:['voice'],note:'African voice TTS / speech'},
  {id:'google-flow',name:'Google Flow',configured:false,tasks:['video','image'],manual:true,note:'Open Flow, generate/export, then import the file into SPP Media Library'},
  {id:'shotoai',name:'ShotoAI',configured:false,tasks:['text','image','video','voice'],future:true,note:'Reserved for SPP-owned AI engine development'}
 ];
}
function aiSafeError(text){return String(text||'Provider request failed.').replace(/sk-[A-Za-z0-9._-]+/g,'[redacted]').slice(0,1200);}
async function aiFetch(url,options={},timeoutMs=55000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const r=await fetch(url,{...options,signal:controller.signal});const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{d={raw};}if(!r.ok)throw new Error(d.error?.message||d.message||d.detail||d.raw||`Provider returned HTTP ${r.status}`);return d;}
 catch(e){if(e.name==='AbortError')throw new Error('Provider request timed out. Check job status before retrying to avoid duplicate charges.');throw e;}
 finally{clearTimeout(timer);}
}
function textFromOpenAI(d){if(d.output_text)return d.output_text;return (d.output||[]).flatMap(x=>(x.content||[]).filter(c=>c.type==='output_text'||c.type==='text').map(c=>c.text||'')).join('\n').trim();}
function textFromClaude(d){return (d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').trim();}
async function aiDownloadGoogleVideo(uri,jobId){
 let target=String(uri||'').trim();let headers={};
 if(!target)throw new Error('Gemini completed without a video URI.');
 if(target.startsWith('files/')){target=`https://generativelanguage.googleapis.com/v1beta/${target}:download?alt=media`;headers['x-goog-api-key']=process.env.GEMINI_API_KEY;}
 let parsed;try{parsed=new URL(target)}catch{throw new Error('Gemini returned a video URI that SPP cannot download automatically. Import the exported file through Media Library.');}
 if(parsed.protocol!=='https:'||!['generativelanguage.googleapis.com','storage.googleapis.com','*.googleusercontent.com'].some(h=>h.startsWith('*.')?parsed.hostname.endsWith(h.slice(1)):parsed.hostname===h))throw new Error('Gemini returned a non-approved video host. Import the exported file through Media Library.');
 if(parsed.hostname==='generativelanguage.googleapis.com')headers['x-goog-api-key']=process.env.GEMINI_API_KEY;
 const response=await fetch(target,{headers,signal:AbortSignal.timeout(55000)});if(!response.ok)throw new Error(`Gemini output download failed with HTTP ${response.status}.`);
 const mime=(response.headers.get('content-type')||'video/mp4').split(';')[0];const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length)throw new Error('Gemini returned an empty video file.');
 const asset=await aiSaveBuffer(buffer,`spp-gemini-${jobId}.mp4`,mime.startsWith('video/')?mime:'video/mp4');return asset;
}
async function aiSaveBuffer(buffer,name,mime,folder='ai-generated'){
 const stored=await storeBuffer(buffer,name,mime,folder);
 const mediaType=mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'file';
 const [r]=await db.execute('INSERT INTO cms_media(original_name,stored_name,url,mime_type,media_type,size_bytes,folder_name,tags,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)',[name,stored.key,stored.url,mime,mediaType,buffer.length,folder,'ai-generated',null]);
 return {id:r.insertId,url:stored.url,storageKey:stored.key,mimeType:mime,name};
}
async function aiUpdateJob(id,patch){
 await db.execute('UPDATE spp_ai_jobs SET status=?,provider_job_id=?,output_url=?,output_mime=?,output_name=?,error_message=?,updated_at=NOW() WHERE id=?',[
  patch.status||'processing',patch.providerJobId??null,patch.outputUrl??null,patch.outputMime??null,patch.outputName??null,patch.error??null,id
 ]);
}
function createKlingJwt(){
 const access=process.env.KLING_ACCESS_KEY,secret=process.env.KLING_SECRET_KEY;if(!access||!secret)return null;
 return jwt.sign({iss:access,exp:Math.floor(Date.now()/1000)+1800,nbf:Math.floor(Date.now()/1000)-5},secret,{algorithm:'HS256',header:{alg:'HS256',typ:'JWT'}});
}
function chooseAiProvider(task,requested){
 if(requested&&requested!=='auto')return requested;
 if(task==='video'){if(process.env.GEMINI_API_KEY)return 'gemini';if(process.env.KLING_ACCESS_KEY&&process.env.KLING_SECRET_KEY)return 'kling';return null;}
 if(task==='image'){if(process.env.OPENAI_API_KEY)return 'openai';if(process.env.GEMINI_API_KEY)return 'gemini';return null;}
 if(task==='voice')return process.env.YARNGPT_API_KEY?'yarngpt':null;
 if(task==='text'){if(process.env.ANTHROPIC_API_KEY)return 'claude';if(process.env.OPENAI_API_KEY)return 'openai';return null;}
 return null;
}
app.get('/api/admin/ai/providers',auth,async(req,res)=>{
 res.json({success:true,data:aiProviderState(),openAIKeySharedBy:['openai','chatgpt']});
});
app.get('/api/admin/ai/jobs',auth,async(req,res)=>{
 try{const limit=Math.min(100,Math.max(1,Number(req.query.limit)||30));const [rows]=await db.execute('SELECT id,provider,task_type,model,prompt,status,provider_job_id,output_url,output_mime,output_name,estimated_usd,actual_usd,error_message,created_at,updated_at FROM spp_ai_jobs WHERE created_by=? ORDER BY created_at DESC LIMIT ?',[req.admin.id,limit]);res.json({success:true,data:rows});}catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/admin/ai/jobs',auth,async(req,res)=>{
 const b=req.body||{};const task=['video','image','text','voice'].includes(String(b.taskType))?String(b.taskType):'text';const requested=String(b.provider||'auto').toLowerCase();
 const allowed=['auto','openai','chatgpt','gemini','claude','kling','yarngpt','google-flow','shotoai'];if(!allowed.includes(requested))return res.status(400).json({error:'Unsupported provider selection.'});
 const prompt=String(b.prompt||'').trim();if(!prompt||prompt.length>15000)return res.status(400).json({error:'Enter a prompt between 1 and 15,000 characters.'});
 if(requested==='google-flow')return res.status(409).json({error:'Google Flow is currently a manual export/import workflow. Open Flow, export your video, then upload it using Media Library.'});
 if(requested==='shotoai')return res.status(501).json({error:'ShotoAI is reserved for future SPP development and is not connected yet.'});
 const provider=chooseAiProvider(task,requested);if(!provider)return res.status(503).json({error:'No configured provider supports this task. Configure the relevant provider key in Vercel server environment variables.'});
 if((provider==='openai'||provider==='chatgpt')&&!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY is not configured.'});
 if(provider==='gemini'&&!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY is not configured.'});
 if(provider==='claude'&&!process.env.ANTHROPIC_API_KEY)return res.status(503).json({error:'ANTHROPIC_API_KEY is not configured.'});
 if(provider==='kling'&&!(process.env.KLING_ACCESS_KEY&&process.env.KLING_SECRET_KEY))return res.status(503).json({error:'KLING_ACCESS_KEY and KLING_SECRET_KEY are required.'});
 if(provider==='yarngpt'&&!process.env.YARNGPT_API_KEY)return res.status(503).json({error:'YARNGPT_API_KEY is not configured.'});
 if((provider==='openai'||provider==='chatgpt')&&!['image','text'].includes(task))return res.status(400).json({error:'OpenAI/ChatGPT is configured for image and text generation in this release.'});
 if(provider==='claude'&&task!=='text')return res.status(400).json({error:'Claude is configured for scripts, storyboards and creative direction, not direct image/video rendering.'});
 if(provider==='kling'&&task!=='video')return res.status(400).json({error:'Kling is configured for video generation.'});
 if(provider==='yarngpt'&&task!=='voice')return res.status(400).json({error:'YarnGPT is configured for voice/audio generation.'});
 if(provider==='gemini'&&!['video','image','text'].includes(task))return res.status(400).json({error:'Gemini supports text, image or video tasks in this integration.'});
 const maxActive=Math.max(1,Number(process.env.SPP_AI_MAX_ACTIVE_JOBS_PER_ADMIN||2));
 const maxDaily=Math.max(1,Number(process.env.SPP_AI_MAX_JOBS_PER_DAY||20));
 try{
  const [[usage]]=await db.execute("SELECT SUM(CASE WHEN status IN ('starting','queued','processing') THEN 1 ELSE 0 END) AS active_jobs,SUM(CASE WHEN created_at>=CURDATE() THEN 1 ELSE 0 END) AS daily_jobs FROM spp_ai_jobs WHERE created_by=?",[req.admin.id]);
  if(Number(usage?.active_jobs||0)>=maxActive)return res.status(429).json({error:`You have reached the ${maxActive}-job active limit. Refresh or wait for a job to finish.`});
  if(Number(usage?.daily_jobs||0)>=maxDaily)return res.status(429).json({error:`You have reached the daily limit of ${maxDaily} AI jobs. Ask an administrator to adjust SPP_AI_MAX_JOBS_PER_DAY.`});
 }catch(e){return res.status(503).json({error:'Unable to check AI usage limits. Check the SPP AI jobs database table.'});}
 let model='',status='processing',providerJobId=null,outputUrl=null,outputMime=null,outputName=null,finalText=null,jobId=null;
 try{
  // Persist the request before calling an external provider so a provider timeout never loses the SPP job record.
  const [created]=await db.execute("INSERT INTO spp_ai_jobs(provider,task_type,model,prompt,status,created_by) VALUES(?,?,NULL,?,'starting',?)",[provider,task,prompt,req.admin.id]);jobId=created.insertId;
  if(provider==='openai'||provider==='chatgpt'){
   if(task==='image'){
    model=process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst';
    const ratio=String(b.aspectRatio||'16:9');const size=ratio==='9:16'?'1024x1536':ratio==='1:1'?'1024x1024':'1536x1024';
    const d=await aiFetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,prompt,size,quality:['low','medium','high','xhigh','max'].includes(b.quality)?b.quality:'high',output_format:'png',n:1})});
    const encoded=d.data?.[0]?.b64_json;if(!encoded)throw new Error('OpenAI returned no image data.');
    const asset=await aiSaveBuffer(Buffer.from(encoded,'base64'),`spp-ai-${Date.now()}.png`,'image/png');outputUrl=asset.url;outputMime=asset.mimeType;outputName=asset.name;status='completed';
   } else {
    model=process.env.OPENAI_TEXT_MODEL||'gpt-6-astra';
    const d=await aiFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt})});finalText=textFromOpenAI(d);if(!finalText)throw new Error('OpenAI returned no text output.');
    const asset=await aiSaveBuffer(Buffer.from(finalText,'utf8'),`spp-ai-${Date.now()}.txt`,'text/plain');outputUrl=asset.url;outputMime='text/plain';outputName=asset.name;status='completed';
   }
  } else if(provider==='claude'){
   model=process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5';
   const d=await aiFetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':process.env.ANTHROPIC_VERSION||'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:4000,messages:[{role:'user',content:prompt}]})});
   finalText=textFromClaude(d);if(!finalText)throw new Error('Claude returned no text output.');const asset=await aiSaveBuffer(Buffer.from(finalText,'utf8'),`spp-claude-${Date.now()}.txt`,'text/plain');outputUrl=asset.url;outputMime='text/plain';outputName=asset.name;status='completed';
  } else if(provider==='gemini'){
   model=task==='video'?(process.env.GEMINI_VIDEO_MODEL||'gemini-omni-1.1-flash'):(task==='image'?(process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-image'):(process.env.GEMINI_TEXT_MODEL||'gemini-3.1-flash'));
   if(task==='text'){
    const d=await aiFetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt})});
    finalText=d.output_text||d.output?.text||d.steps?.flatMap(s=>(s.content||[]).filter(c=>c.type==='text').map(c=>c.text)).join('\n')||'';if(!finalText)throw new Error('Gemini returned no text output.');const asset=await aiSaveBuffer(Buffer.from(finalText,'utf8'),`spp-gemini-${Date.now()}.txt`,'text/plain');outputUrl=asset.url;outputMime='text/plain';outputName=asset.name;status='completed';
   } else if(task==='video'){
    const aspectRatio=String(b.aspectRatio||'16:9');
    if(!['16:9','9:16'].includes(aspectRatio)) throw new Error('Gemini Omni Flash supports 16:9 or 9:16 video. Choose Kling for other aspect ratios.');
    const resolution=String(b.resolution||'720p').toLowerCase();
    if(!['360p','720p','1080p','4k'].includes(resolution)) throw new Error('Unsupported Gemini video resolution. Choose 360p, 720p, 1080p or 4K.');
    // Background Interactions let Vercel return a job ID immediately; the Admin UI polls it.
    // Duration is model-controlled for Gemini Omni Flash (3â€“10 seconds); it is not an API request field.
    const d=await aiFetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt,response_format:{type:'video',resolution,aspect_ratio:aspectRatio,delivery:'uri'},background:true})});
    const interactionId=d.id||d.interaction?.id;if(!interactionId)throw new Error('Gemini did not return a job identifier.');providerJobId=JSON.stringify({kind:'gemini-interaction',id:interactionId});status='processing';
   } else {
    const d=await aiFetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt,response_format:{type:'image',aspect_ratio:b.aspectRatio||'16:9',image_size:b.resolution==='4K'?'4K':'2K'}})});
    const imageNode=d.output_image||d.output?.image||d.steps?.filter(s=>s.type==='model_output').flatMap(s=>s.content||[]).find(c=>c.type==='image')||d.steps?.flatMap(s=>s.content||[]).find(c=>c.type==='image');
    const data=imageNode?.data||imageNode?.image?.data||imageNode?.inline_data?.data;
    if(!data)throw new Error('Gemini returned no inline image payload. Confirm that the selected model supports image output with this API.');
    const mime=imageNode.mime_type||imageNode.mimeType||imageNode.inline_data?.mime_type||'image/png';
    const asset=await aiSaveBuffer(Buffer.from(data,'base64'),`spp-gemini-${Date.now()}.${mime==='image/jpeg'?'jpg':'png'}`,mime);outputUrl=asset.url;outputMime=mime;outputName=asset.name;status='completed';
   }
  } else if(provider==='kling'){
   model=process.env.KLING_VIDEO_MODEL||'kling-3.0';const token=createKlingJwt();
   const requestedDuration=Math.round(Number(b.durationSeconds)||10);const duration=Math.min(15,Math.max(3,requestedDuration));
   const payload={prompt,settings:{resolution:['720p','1080p','4k'].includes(String(b.resolution).toLowerCase())?String(b.resolution).toLowerCase():'1080p',aspect_ratio:b.aspectRatio||'16:9',duration,audio:b.generateAudio===true||b.generateAudio==='on'?'native':'off',multi_shot:true}};
   const d=await aiFetch(`${process.env.KLING_API_BASE||'https://api-singapore.klingai.com'}/text-to-video/kling-3.0`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const taskId=d.data?.id||d.data?.task_id||d.task_id||d.id;if(!taskId)throw new Error('Kling response did not include a task ID. Check the Kling developer API response for your account.');providerJobId=JSON.stringify({kind:'kling',taskId});status='processing';
  } else if(provider==='yarngpt'){
   model='YarnGPT TTS';const idem=crypto.randomUUID();const d=await aiFetch('https://api.yarngpt.ai/api/v1/tts',{method:'POST',headers:{Authorization:`Bearer ${process.env.YARNGPT_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify({text:prompt,voice:b.voice||undefined,output_format:'mp3'})});
   if(!d.job_id)throw new Error('YarnGPT did not return a job_id.');providerJobId=JSON.stringify({kind:'yarngpt',jobId:d.job_id,idempotencyKey:idem});status='processing';
  }
  await db.execute('UPDATE spp_ai_jobs SET model=?,status=?,provider_job_id=?,output_url=?,output_mime=?,output_name=?,updated_at=NOW() WHERE id=?',[model,status,providerJobId,outputUrl,outputMime,outputName,jobId]);
  await cmsAudit(req,'generate','ai_studio',jobId,{provider,task,model,status});
  res.status(201).json({success:true,id:jobId,provider,taskType:task,model,status,outputUrl,outputMime,outputName,text:finalText||undefined,message:status==='completed'?'Generation completed and saved to the SPP Media Library.':'Generation submitted. Refresh this job to check progress.'});
 }catch(e){
  const message=aiSafeError(e.message);if(jobId){try{await db.execute("UPDATE spp_ai_jobs SET status='failed',error_message=?,updated_at=NOW() WHERE id=?",[message,jobId]);await cmsAudit(req,'generate_failed','ai_studio',jobId,{provider,task,error:message});}catch{}}
  else{try{await cmsAudit(req,'generate_failed','ai_studio','new',{provider,task,error:message});}catch{}}
  res.status(502).json({success:false,id:jobId,error:message});
 }
});
app.post('/api/admin/ai/jobs/:id/refresh',auth,async(req,res)=>{
 try{
  const [[job]]=await db.execute('SELECT * FROM spp_ai_jobs WHERE id=? AND created_by=?',[req.params.id,req.admin.id]);if(!job)return res.status(404).json({error:'AI job not found.'});if(job.status==='completed'||job.status==='failed')return res.json({success:true,data:job});
  let meta={};try{meta=JSON.parse(job.provider_job_id||'{}')}catch{}
  if(meta.kind==='gemini-interaction'){
   const d=await aiFetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(meta.id)}`,{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY}});
   const state=String(d.status||d.state||'').toLowerCase();
   const video=d.output_video||d.output?.video||d.steps?.filter(s=>s.type==='model_output').flatMap(s=>s.content||[]).find(c=>c.type==='video')||d.steps?.flatMap(s=>s.content||[]).find(c=>c.type==='video');
   const url=video?.uri||video?.url||d.output_video?.uri||d.output_video?.url;
   const data=video?.data||d.output_video?.data;
   if(data){
    const mime=video?.mime_type||d.output_video?.mime_type||'video/mp4';
    const asset=await aiSaveBuffer(Buffer.from(data,'base64'),`spp-gemini-${job.id}.mp4`,mime);
    await aiUpdateJob(job.id,{status:'completed',outputUrl:asset.url,outputMime:mime,outputName:asset.name,providerJobId:job.provider_job_id});
   }else if(url){
    // URI delivery may require a separate File API processing step before download.
    let fileState='ACTIVE';
    const rawUri=String(url);
    let fileRef='';
    if(rawUri.startsWith('files/'))fileRef=rawUri.split('/').pop().split(':')[0];
    else{try{const parsed=new URL(rawUri);const m=parsed.pathname.match(/\/files\/([^/:]+)/);if(m)fileRef=m[1];}catch{}}
    if(fileRef){
     const info=await aiFetch(`https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(fileRef)}`,{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY}});
     fileState=String(info.state||'').toUpperCase();
     if(fileState==='FAILED')await aiUpdateJob(job.id,{status:'failed',providerJobId:job.provider_job_id,error:'Gemini video file processing failed.'});
    }
    if(!fileRef||fileState==='ACTIVE'){
     const asset=await aiDownloadGoogleVideo(url,job.id);
     await aiUpdateJob(job.id,{status:'completed',outputUrl:asset.url,outputMime:asset.mimeType,outputName:asset.name,providerJobId:job.provider_job_id});
    }
   }else if(['failed','error'].includes(state)){
    await aiUpdateJob(job.id,{status:'failed',providerJobId:job.provider_job_id,error:d.error?.message||d.error||'Gemini generation failed.'});
   }else if(['completed','succeeded','success'].includes(state)){
    throw new Error('Gemini completed but returned no downloadable video URI/data.');
   }
  } else if(meta.kind==='kling'){
   const token=createKlingJwt();
   const d=await aiFetch(`${process.env.KLING_API_BASE||'https://api-singapore.klingai.com'}/tasks?task_ids=${encodeURIComponent(meta.taskId)}`,{headers:{Authorization:`Bearer ${token}`}});
   const t=Array.isArray(d.data)?(d.data[0]||{}):(d.data?.result?.[0]||d.task||d.data||{});
   const state=String(t.status||t.task_status||'').toLowerCase();
   const videoOutput=(Array.isArray(t.outputs)?t.outputs:[]).find(x=>String(x.type||'').toLowerCase()==='video'&&(!x.status||String(x.status).toLowerCase()==='succeeded'));
   const url=videoOutput?.url||t.task_result?.videos?.[0]?.url||t.output?.url;
   if(['succeeded','succeed','success','completed'].includes(state)||url){
    if(!url)throw new Error('Kling reported success but returned no downloadable video URL.');
    const raw=await fetch(url,{signal:AbortSignal.timeout(55000)});if(!raw.ok)throw new Error(`Unable to download Kling output (HTTP ${raw.status}).`);
    const buffer=Buffer.from(await raw.arrayBuffer());if(!buffer.length)throw new Error('Kling returned an empty video file.');
    const mime=(raw.headers.get('content-type')||'video/mp4').split(';')[0];
    const asset=await aiSaveBuffer(buffer,`spp-kling-${job.id}.mp4`,mime.startsWith('video/')?mime:'video/mp4');
    await aiUpdateJob(job.id,{status:'completed',outputUrl:asset.url,outputMime:asset.mimeType,outputName:asset.name,providerJobId:job.provider_job_id});
   }else if(['failed','error'].includes(state)){
    await aiUpdateJob(job.id,{status:'failed',providerJobId:job.provider_job_id,error:t.message||t.task_status_msg||'Kling generation failed.'});
   }
  } else if(meta.kind==='yarngpt'){
   const d=await aiFetch(`https://api.yarngpt.ai/api/v1/status/${encodeURIComponent(meta.jobId)}`,{headers:{Authorization:`Bearer ${process.env.YARNGPT_API_KEY}`}});
   if(d.status==='completed'&&d.audio_url){const raw=await fetch(d.audio_url);if(!raw.ok)throw new Error('Unable to download YarnGPT audio.');const asset=await aiSaveBuffer(Buffer.from(await raw.arrayBuffer()),`spp-yarngpt-${job.id}.mp3`,'audio/mpeg');await aiUpdateJob(job.id,{status:'completed',outputUrl:asset.url,outputMime:'audio/mpeg',outputName:asset.name,providerJobId:job.provider_job_id});}
   else if(d.status==='failed')await aiUpdateJob(job.id,{status:'failed',providerJobId:job.provider_job_id,error:d.error||'YarnGPT synthesis failed.'});
  }
  const [[updated]]=await db.execute('SELECT id,provider,task_type,model,prompt,status,output_url,output_mime,output_name,error_message,created_at,updated_at FROM spp_ai_jobs WHERE id=?',[job.id]);res.json({success:true,data:updated});
 }catch(e){res.status(502).json({error:aiSafeError(e.message)});}
});


app.get("/api/sitemap.xml",async(req,res)=>{
 const base=(await db.query("SELECT canonical_url FROM seo_settings WHERE id=1"))[0][0]?.canonical_url||"";
 const [items]=await db.query("SELECT id,title,updated_at FROM content_items WHERE status='published' ORDER BY updated_at DESC");
 res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.map(x=>`<url><loc>${base}/content.html?id=${x.id}</loc><lastmod>${new Date(x.updated_at).toISOString()}</lastmod></url>`).join("")}</urlset>`);
});


/* ================================================================
   SHOTO POINT CMS V3 - COMPLETE CONTROL CENTRE API
   All Control Centre views have matching API routes.
   ================================================================ */

async function ensureCMSV3(){
  const statements = [
`CREATE TABLE IF NOT EXISTS cms_menus (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(160) NOT NULL, slug VARCHAR(180) NOT NULL UNIQUE,
 location VARCHAR(80) DEFAULT 'header', parent_id INT NULL, sort_order INT DEFAULT 0, enabled TINYINT(1) DEFAULT 1,
 target VARCHAR(20) DEFAULT '_self', url VARCHAR(500) NULL, created_by INT NULL, updated_by INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_content_blocks (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, section VARCHAR(180) NOT NULL, title VARCHAR(255) NULL,
 content_type VARCHAR(60) NOT NULL DEFAULT 'paragraph', placement VARCHAR(60) DEFAULT 'center',
 body LONGTEXT NULL, media_url TEXT NULL, link_url TEXT NULL, settings_json JSON NULL,
 status VARCHAR(30) DEFAULT 'draft', scheduled_at DATETIME NULL, published_at DATETIME NULL,
 created_by INT NULL, updated_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(section), INDEX(status), INDEX(scheduled_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_media (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(255) NOT NULL,
 url TEXT NOT NULL, mime_type VARCHAR(160), media_type VARCHAR(40), size_bytes BIGINT DEFAULT 0,
 alt_text VARCHAR(500), caption TEXT, folder_name VARCHAR(180) DEFAULT 'uploads', tags VARCHAR(1000),
 uploaded_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(media_type), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_analytics_events (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, event_type VARCHAR(50) NOT NULL, entity_type VARCHAR(80) NULL,
 entity_id VARCHAR(120) NULL, path VARCHAR(2000) NULL, metadata_json JSON NULL, visitor_hash CHAR(64) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(event_type), INDEX(entity_type), INDEX(created_at), INDEX(visitor_hash)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_reactions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(80) NOT NULL, entity_id VARCHAR(120) NOT NULL,
 reaction VARCHAR(30) NOT NULL, visitor_hash CHAR(64) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY reaction_once(entity_type,entity_id,reaction,visitor_hash), INDEX(entity_type,entity_id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_comments (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(80) NOT NULL, entity_id VARCHAR(120) NOT NULL,
 name VARCHAR(160), email VARCHAR(320), body TEXT NOT NULL, status VARCHAR(30) DEFAULT 'pending',
 approved_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(status), INDEX(entity_type,entity_id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_settings (
 id INT PRIMARY KEY, company_name VARCHAR(255), site_url VARCHAR(500), timezone VARCHAR(80) DEFAULT 'Africa/Lagos',
 refresh_seconds INT DEFAULT 10, maintenance_mode TINYINT(1) DEFAULT 0, allow_comments TINYINT(1) DEFAULT 1,
 allow_reactions TINYINT(1) DEFAULT 1, require_approval TINYINT(1) DEFAULT 1, updated_by INT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_social_settings (
 id INT PRIMARY KEY, facebook TEXT, instagram TEXT, youtube TEXT, tiktok TEXT, x_url TEXT, whatsapp TEXT,
 linkedin TEXT, share_enabled TINYINT(1) DEFAULT 1, updated_by INT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_plugins (
 id INT AUTO_INCREMENT PRIMARY KEY, plugin_key VARCHAR(100) UNIQUE, name VARCHAR(180), category VARCHAR(80),
 enabled TINYINT(1) DEFAULT 0, config_json JSON NULL, updated_by INT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_notifications (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), message TEXT, type VARCHAR(40) DEFAULT 'info',
 audience VARCHAR(80) DEFAULT 'admin', status VARCHAR(30) DEFAULT 'unread', created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(status)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_messages (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, channel VARCHAR(30) DEFAULT 'internal', recipient VARCHAR(320), subject VARCHAR(255),
 body TEXT, status VARCHAR(30) DEFAULT 'queued', provider_message_id VARCHAR(255), created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_wallet (
 id INT PRIMARY KEY, balance DECIMAL(18,2) DEFAULT 0, currency VARCHAR(10) DEFAULT 'NGN', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_wallet_transactions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(30), amount DECIMAL(18,2), reference VARCHAR(180), status VARCHAR(30) DEFAULT 'pending',
 note TEXT, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(status), INDEX(type)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_meeting_links (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, meeting_id BIGINT NULL, provider VARCHAR(40), title VARCHAR(255), join_url TEXT,
 host_url TEXT, passcode VARCHAR(120), status VARCHAR(30) DEFAULT 'pending', created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_audit (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, admin_id INT NULL, action VARCHAR(100), module VARCHAR(100), entity_id VARCHAR(120),
 details_json JSON NULL, ip_address VARCHAR(64), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(admin_id), INDEX(created_at)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_approvals (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, module VARCHAR(100), entity_id VARCHAR(120), requested_by INT NULL,
 status VARCHAR(30) DEFAULT 'pending', reviewer_id INT NULL, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, reviewed_at DATETIME NULL, INDEX(status), INDEX(module)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS cms_revisions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(100), entity_id VARCHAR(120), snapshot_json JSON,
 created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(entity_type,entity_id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS spp_ai_jobs (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 provider VARCHAR(40) NOT NULL,
 task_type VARCHAR(30) NOT NULL,
 model VARCHAR(160) NULL,
 prompt LONGTEXT NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'queued',
 provider_job_id VARCHAR(500) NULL,
 output_url TEXT NULL,
 output_mime VARCHAR(120) NULL,
 output_name VARCHAR(255) NULL,
 estimated_usd DECIMAL(12,4) DEFAULT 0,
 actual_usd DECIMAL(12,4) DEFAULT 0,
 error_message TEXT NULL,
 created_by INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(status), INDEX(provider), INDEX(created_at), INDEX(created_by)
) ENGINE=InnoDB`
  ];
  for(const q of statements) await db.query(q);
  await db.query("INSERT IGNORE INTO cms_settings(id,company_name,site_url,timezone,refresh_seconds) VALUES(1,'Shoto Point Productions','http://127.0.0.1:5500','Africa/Lagos',10)");
  await db.query("INSERT IGNORE INTO cms_social_settings(id) VALUES(1)");
  await db.query("INSERT IGNORE INTO cms_wallet(id,balance,currency) VALUES(1,0,'NGN')");
  const [m]=await db.query("SELECT COUNT(*) c FROM cms_menus");
  if(!Number(m[0].c)) await seedSppMenus(false);

}

async function seedSppMenus(replaceExisting=false){
 const tree=[
  {name:'Home',slug:'home',url:'/index.html'},
  {name:'About',slug:'about',url:'/about.html'},
  {name:'Services',slug:'services',url:'/services.html'},
  {name:'Production',slug:'production',url:'/Production.html',children:[
   ['Film Production','film-production','/FilmProduction.html'],['Television Production','television-production','/TelevisionProduction.html'],['Documentary','documentary','/Documentary.html'],['Photography','photography','/Photography.html'],['Commercials','commercials','/Commercials.html'],['Digital Media','digital-media','/DigitalMedia.html'],['Post Production','post-production','/PostProduction.html'],['Creative Development','creative-development','/CreativeDevelopment.html'],['Talent & Casting','talent-casting','/TalentCasting.html']
  ]},
  {name:'Live Session',slug:'live-session',url:'/PodcastLiveSessions.html',children:[
   ['Podcast & Live Sessions','podcast-live-sessions','/PodcastLiveSessions.html'],['Online Trainings & Recruitment','online-training-recruitment','/OnlineTrainingRecruitment.html'],['Private Meeting','private-meeting','/PrivateMeeting.html']
  ]},
  {name:'Team',slug:'team',url:'/team.html',children:[['Executive','team-executive','/team.html#executive'],['Administrative','team-administrative','/team.html#administrative'],['Senior','team-senior','/team.html#senior']]},
  {name:'Our Webs',slug:'our-webs',url:'/news.html',children:[['Our News','our-news','/news.html'],['SYFM','syfm','/SYFM4.html']]},
  {name:'Our Stories',slug:'our-stories',url:'/Novel.html',children:[['Novels','novels','/Novel.html'],['Songs','songs','/Songs.html'],['Tutorials','tutorials','/Tutorials.html'],['Have a Story','have-a-story','/HaveAStory.html']]},
  {name:'News',slug:'news',url:'/news.html'},
  {name:'Contact',slug:'contact',url:'/contact.html'},
  {name:'Start a Project',slug:'start-a-project',url:'/contact.html'}
 ];
 const conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  if(replaceExisting) await conn.query("DELETE FROM cms_menus WHERE location IN ('header','footer','nav')");
  const [[count]]=await conn.query("SELECT COUNT(*) c FROM cms_menus WHERE location='header'");
  const ids={}; let order=0;
  for(const item of tree){
   order++;
   let [r]=await conn.execute("INSERT INTO cms_menus(name,slug,location,parent_id,sort_order,enabled,target,url) VALUES(?,?, 'header',NULL,?,1,'_self',?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),name=VALUES(name),location='header',parent_id=NULL,sort_order=VALUES(sort_order),enabled=1,target='_self',url=VALUES(url)",[item.name,item.slug,order,item.url]);
   ids[item.slug]=r.insertId;
   for(let i=0;i<(item.children||[]).length;i++){
    const [name,slug,url]=item.children[i];
    const [child]=await conn.execute("INSERT INTO cms_menus(name,slug,location,parent_id,sort_order,enabled,target,url) VALUES(?,?, 'header',?,?,1,'_self',?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),name=VALUES(name),location='header',parent_id=VALUES(parent_id),sort_order=VALUES(sort_order),enabled=1,target='_self',url=VALUES(url)",[name,slug,ids[item.slug],i+1,url]);
    ids[slug]=child.insertId;
   }
  }
  const managedSimpleMenus=[
   {location:'news',items:[
    ['All News','all','/news.html?category=all'],['Nigeria','nigeria','/news.html?category=nigeria'],['Politics','politics','/news.html?category=politics'],['Celebrities','celebrities','/news.html?category=celebrities'],['Movies','movies','/news.html?category=movies'],['Actors','actors','/news.html?category=actors'],['Musicians','musicians','/news.html?category=musicians'],['Talents','talents','/news.html?category=talents'],['Football','football','/news.html?category=football'],['Media','media','/news.html?category=media'],['Technology','tech','/news.html?category=tech'],['World','world','/news.html?category=world'],['SPP Originals','spp','/news.html?category=spp']
   ],prefix:'news-'},
   {location:'production',items:[
    ['Browse All','all','/Production.html'],['Film Production','film-production','/FilmProduction.html'],['Television Production','television-production','/TelevisionProduction.html'],['Documentary','documentary','/Documentary.html'],['Photography','photography','/Photography.html'],['Commercials','commercials','/Commercials.html'],['Digital Media','digital-media','/DigitalMedia.html'],['Post Production','post-production','/PostProduction.html'],['Creative Development','creative-development','/CreativeDevelopment.html'],['Talent & Casting','talent-casting','/TalentCasting.html']
   ],prefix:'production-'},
   {location:'photography',items:[
    ['Production','production','/Production.html'],['Photography Gallery','gallery','/Photography.html'],['Sell Your Work','sell-your-work','/Photography.html#sell-on-spp']
   ],prefix:'photography-'},
   {location:'footer',items:[
    ['Home','home','/index.html'],['About','about','/about.html'],['Production','production','/Production.html'],['News','news','/news.html'],['Novels','novels','/Novel.html'],['Songs','songs','/Songs.html'],['Tutorials','tutorials','/Tutorials.html'],['Contact','contact','/contact.html']
   ],prefix:'footer-'}
  ];
  for(const group of managedSimpleMenus){
   if(replaceExisting) await conn.query('DELETE FROM cms_menus WHERE location=?',[group.location]);
   const [[menuCount]]=await conn.query('SELECT COUNT(*) c FROM cms_menus WHERE location=?',[group.location]);
   if(replaceExisting||!Number(menuCount.c)){let idx=0;for(const [name,slug,url] of group.items){idx++;await conn.execute("INSERT INTO cms_menus(name,slug,location,parent_id,sort_order,enabled,target,url) VALUES(?,?,?,NULL,?,1,'_self',?) ON DUPLICATE KEY UPDATE name=VALUES(name),location=VALUES(location),parent_id=NULL,sort_order=VALUES(sort_order),enabled=1,target='_self',url=VALUES(url)",[name,group.prefix+slug,group.location,idx,url]);}}
  }
  await conn.commit();
  return {count:tree.reduce((n,x)=>n+1+(x.children||[]).length,0),newsCategoryCount:managedSimpleMenus.find(x=>x.location==='news').items.length,productionNavCount:managedSimpleMenus.find(x=>x.location==='production').items.length,photographyNavCount:managedSimpleMenus.find(x=>x.location==='photography').items.length,footerNavCount:managedSimpleMenus.find(x=>x.location==='footer').items.length,previousCount:Number(count.c)};
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}

async function cmsAudit(req,action,module,entityId,details){
  try{await db.execute("INSERT INTO cms_audit(admin_id,action,module,entity_id,details_json,ip_address) VALUES(?,?,?,?,?,?)",[req.admin?.id||null,action,module,String(entityId??''),details?JSON.stringify(details):null,req.ip||'']);}catch(e){}
}
function visitorHash(req){return crypto.createHash('sha256').update(String(req.ip||'')+'|'+String(req.headers['user-agent']||'')).digest('hex')}
function jsonSetting(v){try{return v?JSON.parse(v):{}}catch{return {}}}

app.get('/api/cms/version',(req,res)=>res.json({success:true,version:'3.0.0',cms:true,api:'shoto-point'}));

app.get('/api/admin/cms/summary',auth,async(req,res)=>{
 try{
  const [[content]] = await db.query("SELECT COUNT(*) c FROM content_items WHERE status='published'");
  const [[blocks]] = await db.query("SELECT COUNT(*) c FROM cms_content_blocks WHERE status='published'");
  const [[media]] = await db.query("SELECT COUNT(*) c FROM cms_media");
  const [[pendingNews]] = await db.query("SELECT COUNT(*) c FROM news_submissions WHERE status='pending'");
  const [[comments]] = await db.query("SELECT COUNT(*) c FROM cms_comments WHERE status='pending'");
  const [[members]] = await db.query("SELECT COUNT(*) c FROM customers");
  const [[visits]] = await db.query("SELECT COUNT(*) c FROM website_analytics WHERE created_at>=NOW()-INTERVAL 30 DAY");
  const [[events]] = await db.query("SELECT COUNT(*) c FROM cms_analytics_events WHERE created_at>=NOW()-INTERVAL 30 DAY");
  res.json({success:true,data:{content:Number(content.c),blocks:Number(blocks.c),media:Number(media.c),pendingNews:Number(pendingNews.c),pendingComments:Number(comments.c),members:Number(members.c),visitors:Number(visits.c),events:Number(events.c)}});
 }catch(e){res.status(500).json({error:e.message})}
});

app.get('/api/admin/cms/engagement',auth,async(req,res)=>{
 try{
  const [rows]=await db.query("SELECT event_type,COUNT(*) count FROM cms_analytics_events WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY event_type ORDER BY count DESC");
  const [daily]=await db.query("SELECT DATE(created_at) day,COUNT(*) count FROM cms_analytics_events WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY DATE(created_at) ORDER BY day");
  res.json({success:true,data:{events:rows,daily}});
 }catch(e){res.status(500).json({error:e.message})}
});

// Private admin bridge to the SPP Have a Story Supabase project.
// The service-role key is read only from server environment variables and is never returned to the browser.
function supabaseAdminConfigured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);}
async function supabaseAdminRequest(resource,options={}){
 if(!supabaseAdminConfigured()) throw new Error('Community moderation is not connected. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.');
 const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
 const target=new URL(`/rest/v1/${resource}`,base);
 const response=await fetch(target,{...options,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:options.method==='PATCH'?'return=representation':'count=exact',...(options.headers||{})},signal:AbortSignal.timeout(15000)});
 const raw=await response.text();let data=[];try{data=raw?JSON.parse(raw):[]}catch{data=[];}
 if(!response.ok) throw new Error(data?.message||data?.error_description||`Supabase returned HTTP ${response.status}.`);
 return data;
}
app.get('/api/admin/community/overview',auth,async(req,res)=>{
 try{
  if(!supabaseAdminConfigured()) return res.status(503).json({success:false,error:'Community moderation is not connected. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.'});
  const [pendingPosts,pendingProfiles,publishedPosts,approvedProfiles]=await Promise.all([
   supabaseAdminRequest('community_posts?select=id,category,title,summary,creator_id,status,created_at,creator:profiles!community_posts_creator_id_fkey(display_name)&status=eq.pending&order=created_at.desc&limit=100'),
   supabaseAdminRequest('profiles?select=id,display_name,role,is_approved,created_at&is_approved=eq.false&order=created_at.desc&limit=100'),
   supabaseAdminRequest('community_posts?select=id&status=eq.published&limit=1000'),
   supabaseAdminRequest('profiles?select=id&is_approved=eq.true&limit=1000')
  ]);
  res.json({success:true,data:{pendingPosts,pendingProfiles,publishedPosts:publishedPosts.length,approvedProfiles:approvedProfiles.length}});
 }catch(e){res.status(502).json({success:false,error:e.message});}
});
app.patch('/api/admin/community/posts/:id',auth,async(req,res)=>{
 try{
  const id=String(req.params.id||'');if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return res.status(400).json({error:'Invalid community post ID.'});
  const status=['published','rejected','pending'].includes(req.body?.status)?req.body.status:null;if(!status)return res.status(400).json({error:'Choose published, rejected or pending.'});
  const data=await supabaseAdminRequest(`community_posts?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,updated_at:new Date().toISOString()})});
  await cmsAudit(req,'community_'+status,'community_post',id,{status});res.json({success:true,data});
 }catch(e){res.status(502).json({success:false,error:e.message});}
});
app.patch('/api/admin/community/profiles/:id',auth,async(req,res)=>{
 try{
  const id=String(req.params.id||'');if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return res.status(400).json({error:'Invalid creator profile ID.'});
  if(typeof req.body?.isApproved!=='boolean')return res.status(400).json({error:'isApproved must be true or false.'});
  const data=await supabaseAdminRequest(`profiles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({is_approved:req.body.isApproved})});
  await cmsAudit(req,req.body.isApproved?'approve_creator':'keep_creator_pending','community_profile',id,{isApproved:req.body.isApproved});res.json({success:true,data});
 }catch(e){res.status(502).json({success:false,error:e.message});}
});
app.delete('/api/admin/community/comments/:id',auth,async(req,res)=>{
 try{
  const id=String(req.params.id||'');if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return res.status(400).json({error:'Invalid community comment ID.'});
  await supabaseAdminRequest(`community_comments?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});await cmsAudit(req,'delete','community_comment',id);res.json({success:true});
 }catch(e){res.status(502).json({success:false,error:e.message});}
});

app.get('/api/admin/cms/activity',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_audit ORDER BY created_at DESC LIMIT 200");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/cms/approvals',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_approvals WHERE status='pending' ORDER BY created_at DESC");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/approvals/:id',auth,async(req,res)=>{try{const status=['approved','rejected'].includes(req.body.status)?req.body.status:'approved';await db.execute("UPDATE cms_approvals SET status=?,reviewer_id=?,notes=?,reviewed_at=NOW() WHERE id=?",[status,req.admin.id,req.body.notes||null,req.params.id]);await cmsAudit(req,status,'approval',req.params.id,req.body);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/menus',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_menus ORDER BY location,parent_id,sort_order,id");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/menus/seed-spp',auth,async(req,res)=>{try{const result=await seedSppMenus(true);await cmsAudit(req,'seed','menus','spp-canonical',result);res.json({success:true,data:result,message:'SPP public navigation structure installed.'})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/menus',auth,async(req,res)=>{try{const b=req.body||{};if(!b.name||!b.slug)return res.status(400).json({error:'Name and slug are required.'});const [r]=await db.execute("INSERT INTO cms_menus(name,slug,location,parent_id,sort_order,enabled,target,url,created_by) VALUES(?,?,?,?,?,?,?,?,?)",[b.name,b.slug,b.location||'header',b.parentId||null,Number(b.sortOrder)||0,b.enabled===false?0:1,b.target||'_self',b.url||'#',req.admin.id]);await cmsAudit(req,'create','menu',r.insertId,b);res.json({success:true,id:r.insertId})}catch(e){res.status(400).json({error:e.message})}});
app.put('/api/admin/cms/menus/:id',auth,async(req,res)=>{try{const b=req.body||{};await db.execute("UPDATE cms_menus SET name=COALESCE(?,name),slug=COALESCE(?,slug),location=COALESCE(?,location),parent_id=?,sort_order=COALESCE(?,sort_order),enabled=COALESCE(?,enabled),target=COALESCE(?,target),url=COALESCE(?,url),updated_by=? WHERE id=?",[b.name||null,b.slug||null,b.location||null,b.parentId||null,b.sortOrder===undefined?null:Number(b.sortOrder),b.enabled===undefined?null:(b.enabled?1:0),b.target||null,b.url||null,req.admin.id,req.params.id]);await cmsAudit(req,'update','menu',req.params.id,b);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.delete('/api/admin/cms/menus/:id',auth,async(req,res)=>{try{await db.execute("DELETE FROM cms_menus WHERE id=? OR parent_id=?",[req.params.id,req.params.id]);await cmsAudit(req,'delete','menu',req.params.id);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/content-blocks',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_content_blocks ORDER BY updated_at DESC");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/content-blocks',auth,async(req,res)=>{try{const b=req.body||{};if(!b.section||!b.contentType)return res.status(400).json({error:'Section and content type are required.'});const status=b.status||'draft';const [r]=await db.execute("INSERT INTO cms_content_blocks(section,title,content_type,placement,body,media_url,link_url,settings_json,status,scheduled_at,published_at,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[b.section,b.title||null,b.contentType,b.placement||'center',b.body||null,b.mediaUrl||null,b.linkUrl||null,b.settings?JSON.stringify(b.settings):null,status,b.scheduledAt||null,status==='published'?new Date():null,req.admin.id,req.admin.id]);await cmsAudit(req,'create','content_block',r.insertId,b);res.json({success:true,id:r.insertId})}catch(e){res.status(400).json({error:e.message})}});
app.put('/api/admin/cms/content-blocks/:id',auth,async(req,res)=>{try{const b=req.body||{};await db.execute("UPDATE cms_content_blocks SET section=COALESCE(?,section),title=?,content_type=COALESCE(?,content_type),placement=COALESCE(?,placement),body=?,media_url=?,link_url=?,settings_json=?,status=COALESCE(?,status),scheduled_at=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?",[b.section||null,b.title||null,b.contentType||null,b.placement||null,b.body??null,b.mediaUrl??null,b.linkUrl??null,b.settings?JSON.stringify(b.settings):null,b.status||null,b.scheduledAt||null,b.status||'',req.admin.id,req.params.id]);await cmsAudit(req,'update','content_block',req.params.id,b);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.delete('/api/admin/cms/content-blocks/:id',auth,async(req,res)=>{try{await db.execute("DELETE FROM cms_content_blocks WHERE id=?",[req.params.id]);await cmsAudit(req,'delete','content_block',req.params.id);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/admin/cms/content-blocks/publish-section',auth,async(req,res)=>{try{
 const section=String(req.body?.section||'').trim();
 if(!section)return res.status(400).json({error:'A page section is required.'});
 const [r]=await db.execute("UPDATE cms_content_blocks SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW(),updated_by=? WHERE section=? AND (scheduled_at IS NULL OR scheduled_at<=NOW()) AND status IN ('draft','pending_review','scheduled')",[req.admin.id,section]);
 await cmsAudit(req,'publish','content_section',section,{published:r.affectedRows});
 res.json({success:true,published:r.affectedRows});
}catch(e){res.status(400).json({error:e.message})}});
// SPP_CMS_PUBLISH_SECTION
app.get('/api/public/cms/content',async(req,res)=>{try{
 const section=String(req.query.section||'').trim();
 const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
 const [rows]=section
  ? await db.execute("SELECT * FROM cms_content_blocks WHERE status='published' AND section=? AND (scheduled_at IS NULL OR scheduled_at<=NOW()) ORDER BY updated_at DESC LIMIT ?",[section,limit])
  : await db.execute("SELECT * FROM cms_content_blocks WHERE status='published' AND (scheduled_at IS NULL OR scheduled_at<=NOW()) ORDER BY updated_at DESC LIMIT ?",[limit]);
 res.set('Cache-Control','public, max-age=5, stale-while-revalidate=10');
 res.json({success:true,data:rows});
}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/public/cms/menus',async(req,res)=>{try{
 const allowedLocations=new Set(['header','footer','nav','sidebar','production','photography','news','syfm']);
 const requestedLocation=String(req.query.location||'header');
 const location=allowedLocations.has(requestedLocation)?requestedLocation:'header';
 const [rows]=await db.execute('SELECT id,name,slug,location,parent_id,sort_order,target,url FROM cms_menus WHERE enabled=1 AND location=? ORDER BY sort_order ASC,name ASC',[location]);
 const map=new Map(rows.map(x=>[Number(x.id),{...x,id:Number(x.id),parent_id:x.parent_id?Number(x.parent_id):null,children:[]}]));
 const roots=[]; for(const item of map.values()){if(item.parent_id&&map.has(item.parent_id))map.get(item.parent_id).children.push(item);else roots.push(item);}
 res.set('Cache-Control','public, max-age=5, stale-while-revalidate=10');
 res.json({success:true,data:roots});
}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/admin/cms/media',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_media ORDER BY created_at DESC LIMIT 500");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/media/presign',auth,async(req,res)=>{try{
 const b=req.body||{};const name=String(b.fileName||'asset').slice(0,240);const mime=String(b.mimeType||'application/octet-stream').slice(0,120).toLowerCase();const size=Number(b.size||0);
 if(!validateMediaType(mime))return res.status(415).json({error:'Unsupported media type. Upload an approved image, video, audio or PDF file.'});
 if(!size||size>Number(process.env.MAX_DIRECT_UPLOAD_BYTES||2*1024*1024*1024))return res.status(400).json({error:'Choose a file within the configured upload limit.'});
 const client=getS3Client();if(!client)return res.json({success:true,directUpload:false,message:'Direct object-storage uploads are not configured; use the standard upload route for small local files.'});
 const ext=path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g,'').slice(0,12);const key=`uploads/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}${ext}`;
 const uploadUrl=await presignUpload(key,mime);const publicUrl=publicObjectUrl(key);
 res.json({success:true,directUpload:true,uploadUrl,storageKey:key,url:publicUrl,expiresIn:600});
}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/admin/cms/media/complete',auth,async(req,res)=>{try{
 const b=req.body||{};const key=String(b.storageKey||'');if(!key.startsWith('uploads/')||key.includes('..'))return res.status(400).json({error:'Invalid storage key.'});
 const client=getS3Client();if(!client)return res.status(400).json({error:'Persistent object storage is not configured.'});
 const {HeadObjectCommand}=require('@aws-sdk/client-s3');const head=await client.send(new HeadObjectCommand({Bucket:process.env.R2_BUCKET,Key:key}));
 const actualSize=Number(head.ContentLength||0);if(!actualSize||actualSize>Number(process.env.MAX_DIRECT_UPLOAD_BYTES||2*1024*1024*1024))return res.status(413).json({error:'Uploaded object exceeds the configured file-size limit.'});const mime=String(head.ContentType||b.mimeType||'application/octet-stream').toLowerCase();if(!validateMediaType(mime))return res.status(415).json({error:'The uploaded object has an unsupported content type.'});const type=mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':mime==='application/pdf'?'document':'file';
 const url=publicObjectUrl(key);const [r]=await db.execute('INSERT INTO cms_media(original_name,stored_name,url,mime_type,media_type,size_bytes,alt_text,caption,folder_name,tags,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[String(b.fileName||path.basename(key)).slice(0,255),key,url,mime,type,actualSize,b.altText||null,b.caption||null,b.folder||'uploads',b.tags||null,req.admin.id]);
 await cmsAudit(req,'upload','media',r.insertId,{name:b.fileName,type,storage:'r2'});res.json({success:true,id:r.insertId,url,mediaType:type,originalName:b.fileName});
}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/admin/cms/media',auth,upload.single('file'),async(req,res)=>{try{
 if(!req.file)return res.status(400).json({error:'No file uploaded.'});const mime=String(req.file.mimetype||'').toLowerCase();if(!validateMediaType(mime))return res.status(415).json({error:'Unsupported file type. Upload JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV, audio or PDF.'});const type=mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':mime==='application/pdf'?'document':'file';
 const stored=await storeBuffer(req.file.buffer,req.file.originalname,mime,'uploads');
 const [r]=await db.execute('INSERT INTO cms_media(original_name,stored_name,url,mime_type,media_type,size_bytes,alt_text,caption,folder_name,tags,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[req.file.originalname,stored.key,stored.url,mime,type,req.file.size,req.body.altText||null,req.body.caption||null,req.body.folder||'uploads',req.body.tags||null,req.admin.id]);
 await cmsAudit(req,'upload','media',r.insertId,{name:req.file.originalname,type});res.json({success:true,id:r.insertId,url:stored.url,storageKey:stored.key,mediaType:type,originalName:req.file.originalname});
}catch(e){res.status(400).json({error:e.message})}});
app.delete('/api/admin/cms/media/:id',auth,async(req,res)=>{try{const [[m]]=await db.query('SELECT stored_name FROM cms_media WHERE id=?',[req.params.id]);if(m?.stored_name)await deleteStoredObject(m.stored_name);await db.execute('DELETE FROM cms_media WHERE id=?',[req.params.id]);await cmsAudit(req,'delete','media',req.params.id);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/analytics',auth,async(req,res)=>{try{const [events]=await db.query("SELECT event_type,entity_type,COUNT(*) count FROM cms_analytics_events WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY event_type,entity_type ORDER BY count DESC");const [daily]=await db.query("SELECT DATE(created_at) day,COUNT(*) count FROM cms_analytics_events WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY DATE(created_at) ORDER BY day");const [pages]=await db.query("SELECT path,COUNT(*) count FROM website_analytics WHERE created_at>=NOW()-INTERVAL 30 DAY GROUP BY path ORDER BY count DESC LIMIT 30");res.json({success:true,data:{events,daily,pages}})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/public/event',async(req,res)=>{try{const b=req.body||{};const allowed=['visit','read','watch','download','share','like','comment','play','search'];const type=allowed.includes(String(b.eventType))?String(b.eventType):'visit';await db.execute("INSERT INTO cms_analytics_events(event_type,entity_type,entity_id,path,metadata_json,visitor_hash) VALUES(?,?,?,?,?,?)",[type,b.entityType||null,b.entityId||null,String(b.path||'').slice(0,2000),b.metadata?JSON.stringify(b.metadata):null,visitorHash(req)]);res.json({success:true})}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/admin/cms/engagement/live',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT event_type,entity_type,entity_id,path,created_at FROM cms_analytics_events WHERE created_at>=NOW()-INTERVAL 5 MINUTE ORDER BY created_at DESC LIMIT 100");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/cms/comments',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_comments ORDER BY created_at DESC LIMIT 500");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/comments/:id',auth,async(req,res)=>{try{const status=['approved','rejected','pending'].includes(req.body.status)?req.body.status:'approved';await db.execute("UPDATE cms_comments SET status=?,approved_by=? WHERE id=?",[status,status==='approved'?req.admin.id:null,req.params.id]);await cmsAudit(req,'moderate','comment',req.params.id,{status});res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/public/comment',async(req,res)=>{try{const b=req.body||{};if(!b.entityId||!b.body)return res.status(400).json({error:'Entity and comment are required.'});const [r]=await db.execute("INSERT INTO cms_comments(entity_type,entity_id,name,email,body,status) VALUES(?,?,?,?,?,?)",[b.entityType||'content',String(b.entityId),b.name||'Visitor',b.email||null,b.body,'pending']);res.json({success:true,id:r.insertId,message:'Comment submitted for moderation.'})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/public/reaction',async(req,res)=>{try{const b=req.body||{};if(!b.entityId)return res.status(400).json({error:'Entity is required.'});await db.execute("INSERT IGNORE INTO cms_reactions(entity_type,entity_id,reaction,visitor_hash) VALUES(?,?,?,?)",[b.entityType||'content',String(b.entityId),b.reaction||'like',visitorHash(req)]);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/seo-social',auth,async(req,res)=>{try{const [[seo]]=await db.query("SELECT * FROM seo_settings WHERE id=1");const [[social]]=await db.query("SELECT * FROM cms_social_settings WHERE id=1");res.json({success:true,data:{seo,social}})}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/admin/cms/seo-social',auth,async(req,res)=>{try{const b=req.body||{};const seo=b.seo||{};const social=b.social||{};await db.execute("UPDATE seo_settings SET site_title=?,meta_description=?,canonical_url=?,robots_index=?,sitemap_enabled=?,news_schema_enabled=?,updated_by=? WHERE id=1",[seo.site_title||'',seo.meta_description||'',seo.canonical_url||'',seo.robots_index?1:0,seo.sitemap_enabled?1:0,seo.news_schema_enabled?1:0,req.admin.id]);await db.execute("UPDATE cms_social_settings SET facebook=?,instagram=?,youtube=?,tiktok=?,x_url=?,whatsapp=?,linkedin=?,share_enabled=?,updated_by=? WHERE id=1",[social.facebook||'',social.instagram||'',social.youtube||'',social.tiktok||'',social.x_url||'',social.whatsapp||'',social.linkedin||'',social.share_enabled===false?0:1,req.admin.id]);await cmsAudit(req,'update','seo_social','1',b);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/settings',auth,async(req,res)=>{try{const [[s]]=await db.query("SELECT * FROM cms_settings WHERE id=1");res.json({success:true,data:s})}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/admin/cms/settings',auth,async(req,res)=>{try{const b=req.body||{};await db.execute("UPDATE cms_settings SET company_name=?,site_url=?,timezone=?,refresh_seconds=?,maintenance_mode=?,allow_comments=?,allow_reactions=?,require_approval=?,updated_by=? WHERE id=1",[b.companyName||'',b.siteUrl||'',b.timezone||'UTC',Math.max(5,Number(b.refreshSeconds)||10),b.maintenanceMode?1:0,b.allowComments===false?0:1,b.allowReactions===false?0:1,b.requireApproval===false?0:1,req.admin.id]);await cmsAudit(req,'update','settings','1',b);const [[s]]=await db.query("SELECT * FROM cms_settings WHERE id=1");res.json({success:true,data:s})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/security',auth,async(req,res)=>{try{const [[admins]]=await db.query("SELECT COUNT(*) c FROM admins WHERE status='active'");const [audit]=await db.query("SELECT * FROM cms_audit ORDER BY created_at DESC LIMIT 100");res.json({success:true,data:{activeAdmins:Number(admins.c),audit,security:{jwt:Boolean(JWT_SECRET),httpsRecommended:true,twoFactorEnabled:false}}})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/cms/plugins',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_plugins ORDER BY category,name");const defaults=[['paystack','Paystack','Payments'],['smtp','SMTP','Messaging'],['sms','SMS Provider','Messaging'],['whatsapp','WhatsApp','Messaging'],['google-meet','Google Meet','Meetings'],['zoom','Zoom','Meetings'],['teamviewer','TeamViewer','Meetings']];for(const [k,n,c] of defaults)await db.execute("INSERT IGNORE INTO cms_plugins(plugin_key,name,category) VALUES(?,?,?)",[k,n,c]);const [all]=await db.query("SELECT * FROM cms_plugins ORDER BY category,name");res.json({success:true,data:all})}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/admin/cms/plugins/:key',auth,async(req,res)=>{try{const b=req.body||{};await db.execute("UPDATE cms_plugins SET enabled=?,config_json=?,updated_by=? WHERE plugin_key=?",[b.enabled?1:0,b.config?JSON.stringify(b.config):null,req.admin.id,req.params.key]);await cmsAudit(req,'update','plugin',req.params.key,{enabled:b.enabled});res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/notifications',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_notifications ORDER BY created_at DESC LIMIT 200");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/notifications',auth,async(req,res)=>{try{const b=req.body||{};const [r]=await db.execute("INSERT INTO cms_notifications(title,message,type,audience,created_by) VALUES(?,?,?,?,?)",[b.title||'Notification',b.message||'',b.type||'info',b.audience||'admin',req.admin.id]);await cmsAudit(req,'create','notification',r.insertId,b);res.json({success:true,id:r.insertId})}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/admin/cms/messages',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_messages ORDER BY created_at DESC LIMIT 200");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/messages',auth,async(req,res)=>{try{const b=req.body||{};const [r]=await db.execute("INSERT INTO cms_messages(channel,recipient,subject,body,status,created_by) VALUES(?,?,?,?,?,?)",[b.channel||'internal',b.recipient||'',b.subject||'',b.body||'','queued',req.admin.id]);await cmsAudit(req,'create','message',r.insertId,b);res.json({success:true,id:r.insertId,status:'queued'})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/wallet',auth,async(req,res)=>{try{const [[w]]=await db.query("SELECT * FROM cms_wallet WHERE id=1");const [tx]=await db.query("SELECT * FROM cms_wallet_transactions ORDER BY created_at DESC LIMIT 200");res.json({success:true,data:{wallet:w,transactions:tx}})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/wallet/deposit',auth,async(req,res)=>{try{const amount=Number(req.body.amount);if(!(amount>0))return res.status(400).json({error:'Enter a valid amount.'});const ref='CMS-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();await db.execute("INSERT INTO cms_wallet_transactions(type,amount,reference,status,note,created_by) VALUES('deposit',?,?, 'pending',?,?)",[amount,ref,'Deposit created; Paystack verification required before wallet credit.',req.admin.id]);await cmsAudit(req,'create','wallet_deposit',ref,{amount});res.json({success:true,reference:ref,status:'pending',message:'Deposit record created. Configure Paystack to process payment.'})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/admin/cms/wallet/withdraw',auth,async(req,res)=>{try{const amount=Number(req.body.amount);if(!(amount>0))return res.status(400).json({error:'Enter a valid amount.'});const [[w]]=await db.query("SELECT balance FROM cms_wallet WHERE id=1");if(Number(w.balance)<amount)return res.status(400).json({error:'Insufficient wallet balance.'});const ref='WD-'+Date.now();await db.execute("INSERT INTO cms_wallet_transactions(type,amount,reference,status,note,created_by) VALUES('withdrawal',?,?, 'pending',?,?)",[amount,ref,'Withdrawal awaiting approval.',req.admin.id]);await cmsAudit(req,'create','wallet_withdrawal',ref,{amount});res.json({success:true,reference:ref,status:'pending'})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/meeting-links',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT ml.*,m.full_name AS name,m.email,m.meeting_at FROM cms_meeting_links ml LEFT JOIN meeting_registrations m ON m.id=ml.meeting_id ORDER BY ml.created_at DESC");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/meeting-links/:id',auth,async(req,res)=>{try{const b=req.body||{};const provider=['google-meet','zoom','teamviewer','custom'].includes(b.provider)?b.provider:'custom';const [r]=await db.execute("INSERT INTO cms_meeting_links(meeting_id,provider,title,join_url,host_url,passcode,status,created_by) VALUES(?,?,?,?,?,?,?,?)",[req.params.id,provider,b.title||'Meeting',b.joinUrl||'',b.hostUrl||'',b.passcode||'',b.status||'approved',req.admin.id]);await db.execute("UPDATE meeting_registrations SET status='approved' WHERE id=?",[req.params.id]);await cmsAudit(req,'create','meeting_link',r.insertId,b);res.json({success:true,id:r.insertId})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/admin/cms/schedule',auth,async(req,res)=>{try{const [rows]=await db.query("SELECT * FROM cms_content_blocks WHERE scheduled_at IS NOT NULL ORDER BY scheduled_at ASC");res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/cms/schedule/publish-due',auth,async(req,res)=>{try{const [r]=await db.query("SELECT id FROM cms_content_blocks WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()");if(r.length)await db.query("UPDATE cms_content_blocks SET status='published',published_at=NOW(),updated_by=? WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()",[req.admin.id]);res.json({success:true,published:r.length})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/cms/health',auth,async(req,res)=>{try{await db.query('SELECT 1');const [t]=await db.query("SELECT COUNT(*) c FROM cms_audit WHERE created_at>=NOW()-INTERVAL 1 DAY");res.json({success:true,data:{api:'online',database:'connected',uploads:fs.existsSync(uploadDir),port:PORT,audit24h:Number(t[0].c),serverTime:new Date().toISOString()}})}catch(e){res.status(500).json({success:false,error:e.message})}});

/* =========================================================
   SHOTO POINT PRODUCTION EXPERIENCE API
   ========================================================= */
async function ensureProductionExperienceTables(){
 try{
  try{ await db.query("ALTER TABLE meeting_registrations ADD COLUMN status VARCHAR(30) DEFAULT 'pending'"); }catch(e){}
  try{ await db.query("ALTER TABLE meeting_registrations ADD COLUMN meeting_at DATETIME NULL"); }catch(e){}
  try{ await db.query("ALTER TABLE meeting_registrations ADD COLUMN notes TEXT NULL"); }catch(e){}
  await db.query(`CREATE TABLE IF NOT EXISTS sp_live_streams (id BIGINT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,provider VARCHAR(40) NOT NULL,embed_url TEXT NOT NULL,thumbnail_url TEXT NULL,status VARCHAR(30) DEFAULT 'scheduled',starts_at DATETIME NULL,description TEXT NULL,created_by BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX(status),INDEX(starts_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS sp_page_templates (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(180) NOT NULL,category VARCHAR(80) DEFAULT 'classic',description TEXT,template_json JSON NOT NULL,active TINYINT(1) DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS sp_page_settings (page_slug VARCHAR(180) PRIMARY KEY,template_id INT NULL,green_theme TINYINT(1) DEFAULT 1,font_family VARCHAR(180) DEFAULT 'DM Sans',font_size VARCHAR(30) DEFAULT '16px',accent VARCHAR(30) DEFAULT '#d9b45b',updated_by BIGINT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS sp_code_revisions (id BIGINT AUTO_INCREMENT PRIMARY KEY,file_key VARCHAR(180) NOT NULL,content LONGTEXT NOT NULL,status VARCHAR(30) DEFAULT 'saved',created_by BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(file_key),INDEX(created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS sp_social_share_settings (id INT PRIMARY KEY,facebook TINYINT(1) DEFAULT 1,whatsapp TINYINT(1) DEFAULT 1,x TINYINT(1) DEFAULT 1,telegram TINYINT(1) DEFAULT 1,email TINYINT(1) DEFAULT 1,copy_link TINYINT(1) DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`INSERT IGNORE INTO sp_social_share_settings(id) VALUES(1)`);
  const [[cnt]]=await db.query('SELECT COUNT(*) c FROM sp_page_templates');
  if(Number(cnt.c)===0){
   const templates=[];
   const styles=['Emerald Classic','Executive Green','Editorial Heritage','Cinema Noir Green','Modern Heritage','Glass Green','Luxury Journal','Broadcast Green','Studio Classic','Minimal Emerald'];
   const layouts=['hero-grid','split-story','editorial','cards','timeline','magazine','feature-grid','cinema','profile','catalog'];
   for(let i=0;i<100;i++) templates.push([`${styles[i%styles.length]} ${Math.floor(i/10)+1}`,styles[i%styles.length].toLowerCase().replaceAll(' ','-'),`Professional reusable Shoto Point page template ${i+1}.`,JSON.stringify({layout:layouts[i%layouts.length],theme:'green',font:i%3===0?'Playfair Display':'DM Sans',accent:i%2?'#0d6742':'#d9b45b',sections:['hero','feature','media','call-to-action']}),1]);
   await db.query('INSERT INTO sp_page_templates(name,category,description,template_json,active) VALUES '+templates.map(()=>'(?,?,?,?,?)').join(','),templates.flat());
  }
 }catch(e){console.error('Experience table setup:',e.message)}
}
app.get('/api/public/live-events',async(req,res)=>{try{const [rows]=await db.query("SELECT id,title,provider,embed_url,thumbnail_url,status,starts_at,description FROM sp_live_streams WHERE status IN ('live','scheduled','replay') ORDER BY FIELD(status,'live','scheduled','replay'),starts_at DESC,id DESC LIMIT 20");res.json({success:true,data:rows})}catch(e){res.status(500).json({success:false,error:e.message})}});
app.get('/api/admin/live-events',auth,async(req,res)=>{try{const [rows]=await db.query('SELECT * FROM sp_live_streams ORDER BY starts_at DESC,id DESC LIMIT 100');res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/live-events',auth,async(req,res)=>{try{const b=req.body||{};if(!b.title||!b.provider||!b.embedUrl)return res.status(400).json({error:'Title, provider and embed URL are required.'});const [r]=await db.execute('INSERT INTO sp_live_streams(title,provider,embed_url,thumbnail_url,status,starts_at,description,created_by) VALUES(?,?,?,?,?,?,?,?)',[b.title,b.provider,b.embedUrl,b.thumbnailUrl||null,b.status||'scheduled',b.startsAt||null,b.description||null,req.admin.id]);await cmsAudit(req,'create','live_stream',r.insertId,b);res.json({success:true,id:r.insertId})}catch(e){res.status(400).json({error:e.message})}});
app.put('/api/admin/live-events/:id',auth,async(req,res)=>{try{const b=req.body||{};await db.execute('UPDATE sp_live_streams SET title=?,provider=?,embed_url=?,thumbnail_url=?,status=?,starts_at=?,description=? WHERE id=?',[b.title,b.provider,b.embedUrl,b.thumbnailUrl||null,b.status||'scheduled',b.startsAt||null,b.description||null,req.params.id]);await cmsAudit(req,'update','live_stream',req.params.id,b);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.delete('/api/admin/live-events/:id',auth,async(req,res)=>{try{await db.execute('DELETE FROM sp_live_streams WHERE id=?',[req.params.id]);await cmsAudit(req,'delete','live_stream',req.params.id);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/public/page/:slug',async(req,res)=>{try{const slug=String(req.params.slug);const [[settings]]=await db.query('SELECT * FROM sp_page_settings WHERE page_slug=?',[slug]);const [blocks]=await db.query("SELECT * FROM cms_content_blocks WHERE status='published' AND section=? AND (scheduled_at IS NULL OR scheduled_at<=NOW()) ORDER BY updated_at DESC",[slug]);res.json({success:true,data:{settings,blocks}})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/page/:slug',auth,async(req,res)=>{try{const [[settings]]=await db.query('SELECT * FROM sp_page_settings WHERE page_slug=?',[req.params.slug]);const [blocks]=await db.query('SELECT * FROM cms_content_blocks WHERE section=? ORDER BY updated_at DESC',[req.params.slug]);res.json({success:true,data:{settings,blocks}})}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/admin/page/:slug/settings',auth,async(req,res)=>{try{const b=req.body||{};await db.execute(`INSERT INTO sp_page_settings(page_slug,template_id,green_theme,font_family,font_size,accent,updated_by) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE template_id=VALUES(template_id),green_theme=VALUES(green_theme),font_family=VALUES(font_family),font_size=VALUES(font_size),accent=VALUES(accent),updated_by=VALUES(updated_by)`,[req.params.slug,b.templateId||null,b.greenTheme===false?0:1,b.fontFamily||'DM Sans',b.fontSize||'16px',b.accent||'#d9b45b',req.admin.id]);res.json({success:true})}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/admin/templates',auth,async(req,res)=>{try{const [rows]=await db.query('SELECT * FROM sp_page_templates WHERE active=1 ORDER BY id');res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/templates/:id/export',auth,async(req,res)=>{
 try{
  const [[row]]=await db.query("SELECT id,name,category,description,template_json,active FROM sp_page_templates WHERE id=?",[req.params.id]);
  if(!row)return res.status(404).json({error:"Template not found."});
  res.setHeader("Content-Disposition",`attachment; filename="shoto-point-template-${row.id}.json"`);
  res.json({format:"shoto-point-template-v1",template:row});
 }catch(e){res.status(500).json({error:e.message})}
});
app.post('/api/admin/templates/import',auth,async(req,res)=>{
 try{
  const t=req.body?.template||req.body;
  if(!t?.name)return res.status(400).json({error:"Template name is required."});
  const json=typeof t.template_json==="string"?t.template_json:JSON.stringify(t.template_json||t.templateJson||{});
  JSON.parse(json);
  const [r]=await db.execute("INSERT INTO sp_page_templates(name,category,description,template_json,active) VALUES(?,?,?,?,1)",[
   String(t.name).slice(0,180),String(t.category||"custom").slice(0,80),String(t.description||"Imported Shoto Point design template"),json
  ]);
  await cmsAudit(req,'create','template',r.insertId,{name:t.name});
  res.json({success:true,id:r.insertId});
 }catch(e){res.status(400).json({error:"Invalid template package: "+e.message})}
});

app.get('/api/public/meeting-links',async(req,res)=>{try{const email=String(req.query.email||'').trim();if(!email)return res.status(400).json({error:'Email is required.'});const [rows]=await db.query(`SELECT ml.id,ml.provider,ml.title,ml.join_url,ml.passcode,m.name,m.email,m.status FROM cms_meeting_links ml JOIN meeting_registrations m ON m.id=ml.meeting_id WHERE m.email=? AND ml.status='approved' ORDER BY ml.created_at DESC LIMIT 10`,[email]);res.json({success:true,data:rows})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/meetings/register',async(req,res)=>{try{const b=req.body||{};if(!b.fullName||!b.email||!b.platform)return res.status(400).json({error:'Name, email and platform are required.'});const reg='SP-MEET-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();const [r]=await db.execute('INSERT INTO meeting_registrations(registration_id,platform,full_name,email,phone,status,notes) VALUES(?,?,?,?,?,?,?)',[reg,b.platform,b.fullName,b.email,b.phone||null,'pending',b.notes||null]);res.json({success:true,registrationId:r.insertId,reference:reg,message:'Registration submitted for admin approval.'})}catch(e){res.status(400).json({error:e.message})}});

app.get('/api/public/share-settings',async(req,res)=>{try{const [[s]]=await db.query('SELECT * FROM sp_social_share_settings WHERE id=1');res.json({success:true,data:s})}catch(e){res.status(500).json({error:e.message})}});

// =========================================================
// RECODE ME â€” controlled source-file editor + GitHub/Vercel publisher
// The browser never receives GitHub/Vercel credentials.  On Vercel, source
// changes are published by committing the edited file to the connected Git
// repository; Vercel then builds that commit.  Local saves remain available
// when CODE_EDITOR_ENABLED=true.
// =========================================================
const RECODE_MAX_BYTES=2*1024*1024;
const RECODE_EXTENSIONS=new Set(['.php','.html','.css','.js']);
const RECODE_EXCLUDED_DIRS=new Set(['node_modules','.git','uploads','database','deploy','config','tools','api','scripts']);
const RECODE_EXCLUDED_FILES=new Set(['server.js','package-lock.json','.env','.env.example','Dockerfile','Dockerfile.vercel']);
function normalizeSitePath(value){
 const n=String(value||'').replace(/\\/g,'/').replace(/^\/+/, '');
 if(!n || n.includes('..') || n.includes('\0') || n.startsWith('.git/') || n.startsWith('node_modules/')) return null;
 return n;
}
function isEditableSitePath(name){
 const n=normalizeSitePath(name); if(!n) return false;
 if(RECODE_EXCLUDED_FILES.has(n) || [...RECODE_EXCLUDED_DIRS].some(d=>n===d || n.startsWith(d+'/'))) return false;
 return RECODE_EXTENSIONS.has(path.extname(n).toLowerCase());
}
function listEditableSiteFiles(root=__dirname,relative=''){
 const out=[];
 for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
  if(entry.name.startsWith('.') && entry.name!=='.htaccess') continue;
  const rel=relative?`${relative}/${entry.name}`:entry.name;
  if(entry.isDirectory()){ if(!RECODE_EXCLUDED_DIRS.has(entry.name) && relative.split('/').length<3) out.push(...listEditableSiteFiles(root,rel)); }
  else if(isEditableSitePath(rel)) out.push(rel);
 }
 return out;
}
const CODE_ALLOWLIST=new Set(listEditableSiteFiles());
function localCodePath(name){
 const n=normalizeSitePath(name); if(!n || !CODE_ALLOWLIST.has(n)) return null;
 const root=path.resolve(__dirname), file=path.resolve(root,n);
 if(file!==root && !file.startsWith(root+path.sep)) return null;
 return file;
}
function githubConfigured(){return Boolean(process.env.RECODE_GITHUB_TOKEN && process.env.RECODE_GITHUB_OWNER && process.env.RECODE_GITHUB_REPO);}
function githubHeaders(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${process.env.RECODE_GITHUB_TOKEN}`,'X-GitHub-Api-Version':process.env.RECODE_GITHUB_API_VERSION||'2026-03-10','User-Agent':'Shoto-Point-Recode-Me'};}
function repoPath(name){const prefix=String(process.env.RECODE_GITHUB_ROOT||'').replace(/^\/+|\/+$/g,'');return prefix?`${prefix}/${name}`:name;}
async function githubRequest(url,options={}){
 const r=await fetch(url,{...options,headers:{...githubHeaders(),...(options.headers||{})}});
 const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={message:text};}
 if(!r.ok) throw new Error(data.message||`GitHub API ${r.status}`); return data;
}
app.get('/api/admin/code/status',auth,async(req,res)=>{
 res.json({success:true,data:{localEditorEnabled:String(process.env.CODE_EDITOR_ENABLED||'false')==='true',githubConfigured:githubConfigured(),owner:process.env.RECODE_GITHUB_OWNER||'',repo:process.env.RECODE_GITHUB_REPO||'',branch:process.env.RECODE_GITHUB_BRANCH||'main',vercelHookConfigured:Boolean(process.env.RECODE_VERCEL_DEPLOY_HOOK),vercelHookEnabled:String(process.env.RECODE_TRIGGER_VERCEL_HOOK||'false')==='true',maxBytes:RECODE_MAX_BYTES}});
});
app.get('/api/admin/code/files',auth,async(req,res)=>{res.json({success:true,data:[...CODE_ALLOWLIST].sort()})});
app.get('/api/admin/code/file/:name',auth,async(req,res)=>{try{const name=normalizeSitePath(req.params.name);const p=localCodePath(name);if(!p)return res.status(403).json({error:'File is not editable through Recode Me.'});if(!fs.existsSync(p))return res.status(404).json({error:'File not found.'});const content=fs.readFileSync(p,'utf8');res.json({success:true,data:{name,content,bytes:Buffer.byteLength(content)}})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/admin/code/download/:name',auth,async(req,res)=>{try{const name=normalizeSitePath(req.params.name),p=localCodePath(name);if(!p)return res.status(403).json({error:'File is not editable through Recode Me.'});if(!fs.existsSync(p))return res.status(404).json({error:'File not found.'});res.download(p,path.basename(name));}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/admin/code/file/:name',auth,async(req,res)=>{try{if(String(process.env.CODE_EDITOR_ENABLED||'false')!=='true')return res.status(403).json({error:'Local source saving is disabled. Use Publish to Vercel/GitHub for production source changes.'});const name=normalizeSitePath(req.params.name),p=localCodePath(name);if(!p)return res.status(403).json({error:'File is not editable.'});const content=String(req.body?.content||'');if(Buffer.byteLength(content,'utf8')>RECODE_MAX_BYTES)return res.status(413).json({error:'File is too large.'});fs.writeFileSync(p,content,'utf8');await db.execute('INSERT INTO sp_code_revisions(file_key,content,status,created_by) VALUES(?,?,?,?)',[name,content,'saved-local',req.admin.id]);await cmsAudit(req,'update','code',name,{bytes:Buffer.byteLength(content)});res.json({success:true,message:'Saved locally.',data:{name,bytes:Buffer.byteLength(content)}})}catch(e){res.status(400).json({error:e.message})}});

// Upload a file selected after editing it in VS Code.  The upload is kept in memory
// and is never trusted as a filesystem path.
app.post('/api/admin/code/upload',auth,sourceUpload.single('file'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Choose a file to upload.'});const name=normalizeSitePath(req.body?.name||req.file.originalname);if(!isEditableSitePath(name))return res.status(403).json({error:'Only approved website PHP, HTML, CSS and JS files can be uploaded.'});if(req.file.size>RECODE_MAX_BYTES)return res.status(413).json({error:'File is too large.'});res.json({success:true,data:{name,content:req.file.buffer.toString('utf8'),bytes:req.file.size}})}catch(e){res.status(400).json({error:e.message})}});

app.post('/api/admin/code/publish',auth,async(req,res)=>{
 try{
  if(!githubConfigured()) return res.status(503).json({error:'GitHub publishing is not configured. Set RECODE_GITHUB_OWNER, RECODE_GITHUB_REPO, RECODE_GITHUB_BRANCH and RECODE_GITHUB_TOKEN on the server.'});
  const name=normalizeSitePath(req.body?.name), content=String(req.body?.content||''), message=String(req.body?.message||`Recode Me: update ${name}`);
  if(!isEditableSitePath(name)) return res.status(403).json({error:'File is not approved for publishing.'});
  if(Buffer.byteLength(content,'utf8')>RECODE_MAX_BYTES)return res.status(413).json({error:'File is too large.'});
  if(!content.trim())return res.status(400).json({error:'The file cannot be empty.'});
  const owner=encodeURIComponent(process.env.RECODE_GITHUB_OWNER), repo=encodeURIComponent(process.env.RECODE_GITHUB_REPO), branch=process.env.RECODE_GITHUB_BRANCH||'main', remotePath=repoPath(name);
  const url=`https://api.github.com/repos/${owner}/${repo}/contents/${remotePath.split('/').map(encodeURIComponent).join('/')}`;
  let current=null; try{current=await githubRequest(`${url}?ref=${encodeURIComponent(branch)}`);}catch(e){if(!/404|Not Found/i.test(e.message))throw e;}
  const payload={message,content:Buffer.from(content,'utf8').toString('base64'),branch}; if(current?.sha)payload.sha=current.sha;
  if(process.env.RECODE_GITHUB_COMMITTER_NAME)payload.committer={name:process.env.RECODE_GITHUB_COMMITTER_NAME,email:process.env.RECODE_GITHUB_COMMITTER_EMAIL||'no-reply@shotopoint.com'};
  const result=await githubRequest(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let hookTriggered=false;
  if(process.env.RECODE_VERCEL_DEPLOY_HOOK && String(process.env.RECODE_TRIGGER_VERCEL_HOOK||'false')==='true'){const hr=await fetch(process.env.RECODE_VERCEL_DEPLOY_HOOK,{method:'POST'});hookTriggered=hr.ok;}
  await db.execute('INSERT INTO sp_code_revisions(file_key,content,status,created_by) VALUES(?,?,?,?)',[name,content,'published-github',req.admin.id]);
  await cmsAudit(req,'publish','code',name,{bytes:Buffer.byteLength(content),commit:result.commit?.sha||null,hookTriggered});
  res.json({success:true,message:hookTriggered?'Published to GitHub and Vercel deployment hook triggered.':'Published to GitHub. Vercel Git integration should deploy the new commit.',data:{name,commit:result.commit?.sha||null,commitUrl:result.commit?.html_url||null,branch,hookTriggered}});
 }catch(e){res.status(400).json({error:e.message});}
});


/* =========================================================
   MANAGED PUBLIC CONTENT: SYFM NAVIGATION + SPP NEWS ARTICLES
   ========================================================= */
async function ensureManagedPublishingTables(){
  await db.query(`CREATE TABLE IF NOT EXISTS syfm_site_settings (
    id TINYINT UNSIGNED PRIMARY KEY,
    navigation_json LONGTEXT NOT NULL,
    news_categories_json LONGTEXT NOT NULL,
    join_url VARCHAR(1000) NOT NULL DEFAULT 'MemberShip.html',
    updated_by BIGINT UNSIGNED NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS spp_news_articles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(280) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL DEFAULT 'spp',
    excerpt TEXT NULL,
    body LONGTEXT NOT NULL,
    image_url VARCHAR(2000) NULL,
    author VARCHAR(180) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft',
    featured TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL,
    scheduled_at DATETIME NULL,
    created_by BIGINT UNSIGNED NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_spp_news_status_date(status,published_at),
    INDEX idx_spp_news_category(category,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const defaultNavigation = [
    {label:'Home',href:'#home',enabled:true},
    {label:'About',href:'#about',enabled:true},
    {label:'Vision',href:'#vision',enabled:true},
    {label:'Programmes',href:'#programmes',enabled:true},
    {label:'Leadership',href:'#leadership',enabled:true},
    {label:'Public Affairs',href:'#public-affairs',enabled:true},
    {label:'Membership',href:'#membership',enabled:true},
    {label:'Events',href:'#events',enabled:true},
    {label:'News',href:'#news',enabled:true},
    {label:'Gallery',href:'#gallery',enabled:true},
    {label:'Contact',href:'#contact',enabled:true}
  ];
  const defaultCategories = ['All headlines','Nigeria','Politics','Celebrities','Movies & Film','Actors','Musicians','Talents','Football','Media','Tech','World','SPP Originals'];
  await db.execute(`INSERT IGNORE INTO syfm_site_settings(id,navigation_json,news_categories_json,join_url)
    VALUES(1,?,?,?)`,[JSON.stringify(defaultNavigation),JSON.stringify(defaultCategories),'MemberShip.html']);
}
function parseStoredJson(value,fallback){try{return typeof value==='string'?JSON.parse(value):(value||fallback)}catch{return fallback}}
function safePublicHref(value){
  const href=String(value||'').trim();
  if(!href)return '#home';
  if(/^javascript:/i.test(href)||/^data:/i.test(href))return '#home';
  if(href.startsWith('#'))return href;
  try{const u=new URL(href,'http://spp.local');return ['http:','https:'].includes(u.protocol)?href:'#home'}catch{return '#home'}
}
app.get('/api/public/syfm/navigation',async(req,res)=>{
  try{
    const [[row]]=await db.query('SELECT navigation_json,news_categories_json,join_url,updated_at FROM syfm_site_settings WHERE id=1');
    res.set('Cache-Control','no-store');
    res.json({success:true,data:{navigation:parseStoredJson(row?.navigation_json,[]),newsCategories:parseStoredJson(row?.news_categories_json,[]),joinUrl:row?.join_url||'MemberShip.html',updatedAt:row?.updated_at||null}});
  }catch(e){res.status(500).json({success:false,error:'Unable to load SYFM navigation.'});}
});
app.get('/api/admin/syfm/navigation',auth,async(req,res)=>{
  try{const [[row]]=await db.query('SELECT navigation_json,news_categories_json,join_url,updated_at FROM syfm_site_settings WHERE id=1');res.json({success:true,data:{navigation:parseStoredJson(row?.navigation_json,[]),newsCategories:parseStoredJson(row?.news_categories_json,[]),joinUrl:row?.join_url||'MemberShip.html',updatedAt:row?.updated_at||null}})}
  catch(e){res.status(500).json({success:false,error:e.message});}
});
app.put('/api/admin/syfm/navigation',auth,async(req,res)=>{
  try{
    const b=req.body||{};
    if(!Array.isArray(b.navigation)||b.navigation.length>40)return res.status(400).json({success:false,error:'Navigation must be an array of up to 40 items.'});
    const navigation=b.navigation.map((x,i)=>({label:String(x.label||'').trim().slice(0,80),href:safePublicHref(x.href),enabled:x.enabled!==false,sortOrder:i})).filter(x=>x.label);
    const categories=Array.isArray(b.newsCategories)?b.newsCategories.map(x=>String(x||'').trim().slice(0,80)).filter(Boolean).slice(0,40):['All headlines','Nigeria','Politics','Celebrities','Movies & Film','Actors','Musicians','Talents','Football','Media','Tech','World','SPP Originals'];
    const joinUrl=safePublicHref(b.joinUrl||'MemberShip.html');
    await db.execute(`INSERT INTO syfm_site_settings(id,navigation_json,news_categories_json,join_url,updated_by) VALUES(1,?,?,?,?)
      ON DUPLICATE KEY UPDATE navigation_json=VALUES(navigation_json),news_categories_json=VALUES(news_categories_json),join_url=VALUES(join_url),updated_by=VALUES(updated_by)`,[JSON.stringify(navigation),JSON.stringify(categories),joinUrl,req.admin.id]);
    await activity(req.admin.id,'publish','syfm_navigation','1',{navigationCount:navigation.length,categoryCount:categories.length});
    res.json({success:true,message:'SYFM navigation published to the public website.',data:{navigation,newsCategories:categories,joinUrl}});
  }catch(e){res.status(400).json({success:false,error:e.message});}
});
function newsSlug(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,260)||`story-${Date.now()}`;}
const SPP_NEWS_STATUSES=new Set(['Draft','Pending review','Scheduled','Published']);
async function publishDueSPPNews(){
  await db.execute("UPDATE spp_news_articles SET status='Published',published_at=COALESCE(published_at,scheduled_at,NOW()) WHERE status='Scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()");
}
app.get('/api/admin/news/articles',auth,async(req,res)=>{
  try{await publishDueSPPNews();const [rows]=await db.query('SELECT * FROM spp_news_articles ORDER BY updated_at DESC,id DESC');res.json({success:true,data:rows});}
  catch(e){res.status(500).json({success:false,error:e.message});}
});
app.post('/api/admin/news/articles',auth,async(req,res)=>{
  try{
    const b=req.body||{},title=String(b.title||'').trim(),body=String(b.body||'').trim();
    if(!title||!body)return res.status(400).json({success:false,error:'Headline and article body are required.'});
    const status=SPP_NEWS_STATUSES.has(b.status)?b.status:'Draft';
    if(status==='Scheduled'&&(!b.scheduledAt||Number.isNaN(new Date(b.scheduledAt).getTime())))return res.status(400).json({success:false,error:'Choose a valid scheduled publication date.'});
    let slug=newsSlug(b.slug||title);
    const [exists]=await db.execute('SELECT id FROM spp_news_articles WHERE slug=? LIMIT 1',[slug]);if(exists.length)slug=`${slug}-${Date.now().toString(36)}`;
    const publishedAt=status==='Published'?new Date():null;
    const [r]=await db.execute(`INSERT INTO spp_news_articles(title,slug,category,excerpt,body,image_url,author,status,featured,published_at,scheduled_at,created_by,updated_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[title,slug,String(b.category||'spp').slice(0,100),String(b.excerpt||'').slice(0,2000)||null,body,String(b.imageUrl||'').slice(0,2000)||null,String(b.author||'').slice(0,180)||null,status,b.featured?1:0,publishedAt,b.scheduledAt||null,req.admin.id,req.admin.id]);
    await activity(req.admin.id,status==='Published'?'publish':'create','spp_news_article',String(r.insertId),{title,slug,status});res.status(201).json({success:true,id:r.insertId,slug});
  }catch(e){res.status(400).json({success:false,error:e.code==='ER_DUP_ENTRY'?'That news slug already exists.':e.message});}
});
app.put('/api/admin/news/articles/:id',auth,async(req,res)=>{
  try{
    const b=req.body||{},status=SPP_NEWS_STATUSES.has(b.status)?b.status:null;
    if(status==='Scheduled'&&(!b.scheduledAt||Number.isNaN(new Date(b.scheduledAt).getTime())))return res.status(400).json({success:false,error:'Choose a valid scheduled publication date.'});
    await db.execute(`UPDATE spp_news_articles SET title=COALESCE(?,title),slug=COALESCE(?,slug),category=COALESCE(?,category),excerpt=?,body=COALESCE(?,body),image_url=?,author=?,status=COALESCE(?,status),featured=COALESCE(?,featured),published_at=CASE WHEN ?='Published' THEN COALESCE(published_at,NOW()) WHEN ? IN ('Draft','Pending review','Scheduled') THEN NULL ELSE published_at END,scheduled_at=?,updated_by=? WHERE id=?`,[
      b.title?String(b.title).trim():null,b.slug?newsSlug(b.slug):null,b.category||null,b.excerpt??null,b.body?String(b.body):null,b.imageUrl??null,b.author??null,status,b.featured===undefined?null:(b.featured?1:0),status||'',status||'',b.scheduledAt||null,req.admin.id,req.params.id
    ]);
    await activity(req.admin.id,status==='Published'?'publish':'update','spp_news_article',req.params.id,{title:b.title,status});res.json({success:true});
  }catch(e){res.status(400).json({success:false,error:e.message});}
});
app.delete('/api/admin/news/articles/:id',auth,async(req,res)=>{try{await db.execute('DELETE FROM spp_news_articles WHERE id=?',[req.params.id]);await activity(req.admin.id,'delete','spp_news_article',req.params.id);res.json({success:true});}catch(e){res.status(400).json({success:false,error:e.message});}});
app.get('/api/public/news/articles',async(req,res)=>{
  try{
    await publishDueSPPNews();
    const requestedCategory=String(req.query.category||'').trim().toLowerCase();const limit=Math.min(60,Math.max(1,Number.parseInt(req.query.limit||'24',10)||24));
    const categoryAliases={nigeria:'Nigeria',politics:'Politics',celebrities:'Celebrities',movies:'Movies & Film','movies-film':'Movies & Film',actors:'Actors',musicians:'Musicians',talents:'Talents',football:'Football',media:'Media',tech:'Tech',world:'World','all-headlines':'','spp-originals':'SPP Originals'};
    const category=Object.prototype.hasOwnProperty.call(categoryAliases,requestedCategory)?categoryAliases[requestedCategory]:(requestedCategory&&requestedCategory!=='all'&&requestedCategory!=='spp'?requestedCategory.replace(/-/g,' '):'');
    const where=["status='Published'","(scheduled_at IS NULL OR scheduled_at<=NOW())","(published_at IS NULL OR published_at<=NOW())"];const params=[];
    if(category){where.push('LOWER(category)=LOWER(?)');params.push(category);}
    const [rows]=await db.query(`SELECT id,title,slug,category,excerpt,body,image_url,author,featured,published_at,created_at FROM spp_news_articles WHERE ${where.join(' AND ')} ORDER BY featured DESC,COALESCE(published_at,created_at) DESC,id DESC LIMIT ${limit}`,params);
    res.set('Cache-Control','no-store');res.json({success:true,data:rows});
  }catch(e){res.status(500).json({success:false,error:'Unable to load published SPP news.'});}
});
app.get('/api/public/news/articles/:slug',async(req,res)=>{
  try{await publishDueSPPNews();const [[row]]=await db.execute("SELECT id,title,slug,category,excerpt,body,image_url,author,published_at FROM spp_news_articles WHERE slug=? AND status='Published' AND (scheduled_at IS NULL OR scheduled_at<=NOW()) LIMIT 1",[req.params.slug]);if(!row)return res.status(404).json({success:false,error:'Published article not found.'});res.set('Cache-Control','no-store');res.json({success:true,data:row});}
  catch(e){res.status(500).json({success:false,error:'Unable to load article.'});}
});

let startupPromise=null;
async function ensureStartup(){
 if(!startupPromise){startupPromise=(async()=>{
  if(!JWT_SECRET) throw new Error('JWT_SECRET is required. Add it to your local .env or Vercel environment variables.');
  const conn=await db.getConnection();await conn.ping();conn.release();
  await Promise.all([ensureTeamTable(),ensureCMSV3(),ensureProductionTables(),ensureProductionExperienceTables(),ensureManagedPublishingTables()]);
  return true;
 })().catch(e=>{startupPromise=null;throw e;});}
 return startupPromise;
}



// Public website file serving for local Node/Express runs. API, database, secrets and source files are excluded.
const SPP_PUBLIC_EXTENSIONS=new Set(['.html','.css','.js','.jpg','.jpeg','.png','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.mp4','.webm','.mp3','.wav','.pdf']);
app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$))(.+)$/, (req,res,next)=>{
  let relative;try{relative=decodeURIComponent(String(req.params[0]||''));}catch{return res.status(400).end();}
  if(!relative||relative.includes('\\0'))return next();
  relative=relative.replace(/\\/g,'/');
  const parts=relative.split('/');
  if(parts.some(x=>!x||x.startsWith('.')||['node_modules','database','scripts','private','backups','logs','deploy','config'].includes(x.toLowerCase())))return next();
  const base=path.basename(relative),ext=path.extname(base).toLowerCase();
  if(!SPP_PUBLIC_EXTENSIONS.has(ext)||/^(server|package|package-lock|vercel|\.env)/i.test(base)||/\.sql$|\.md$/i.test(base))return next();
  const root=path.resolve(__dirname),target=path.resolve(root,relative);
  if(!target.startsWith(root+path.sep))return next();
  let st;try{st=fs.statSync(target);}catch{return next();}
  if(!st.isFile())return next();
  res.sendFile(target);
});

// Keep the Express error handler last so it also covers routes registered below the CMS modules.
app.use((err,req,res,next)=>{
 console.error('SPP API request failed:',err?.name||'Error');
 if(res.headersSent)return next(err);
 res.status(500).json({success:false,error:'The SPP service could not complete this request.'});
});

if(require.main===module){
 ensureStartup().then(()=>app.listen(PORT,()=>console.log(`Shoto Point API running on http://127.0.0.1:${PORT}`))).catch(e=>{console.error('Startup failed:',e);process.exitCode=1;});
}
module.exports=app;

