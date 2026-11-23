"use strict";
const crypto=require("node:crypto");
const {URL}=require("node:url");
const CATEGORIES=new Set(["grocery","food","cafe","edu","health","pharmacy","gov","money","jobs","land","build","parts","craft","transport","telecom","utility","farm","mosque","gold","wedding","hotel","market","solar","elec","clothes","home","books","beauty","delivery","salon","laundry","souq","other","marketplace"]);
const PRODUCT_TYPES=new Set(["phone","phone_accessories","watch","computer","computer_accessories","tablet","camera","screen","monitor","charger","audio_accessories","car","motorcycle","vehicle_parts","land","property","apartment","house","electronics","appliance","furniture","clothing","shoes","jewelry","honey","coffee","spices","livestock","agriculture","building_materials","books","stationery","perfume","cosmetics","solar_equipment","solar_panel","battery","inverter","power_system","tools","household_items","kitchenware","baby_products","games","sports_equipment","animal_feed","seeds","construction_equipment","accessories","bag","other"]);
const LISTING_TYPES=new Set(["sale","wanted","barter","free","rent"]);
const PRODUCT_GROUPS = Object.freeze({
  electronics:["phone","phone_accessories","computer","computer_accessories","tablet","camera","electronics","watch","screen","monitor","charger","audio_accessories"],
  vehicles:["car","motorcycle","vehicle_parts"],
  property:["land","property","apartment","house"],
  solar:["solar_equipment","solar_panel","battery","inverter","power_system"],
  home:["furniture","appliance","household_items","kitchenware","baby_products"],
  agriculture:["livestock","agriculture","animal_feed","seeds","honey","coffee","spices","tools","building_materials","construction_equipment"],
  clothing:["clothing","shoes","perfume","cosmetics","jewelry","accessories","bag","other"]
});

const CONDITIONS=new Set(["new","used","unknown"]);
const CURRENCIES=new Set(["YER","SAR","USD","OMR","AED","other"]);
const GOVERNORATES=new Set(["أمانة العاصمة","صنعاء","عدن","تعز","إب","الحديدة","ذمار","البيضاء","لحج","أبين","الضالع","مأرب","الجوف","صعدة","حجة","عمران","المحويت","ريمة","حضرموت","شبوة","المهرة","سقطرى"]);
const buckets=new Map();
let pool=null,poolError=null,schemaPromise=null;
function error(code,message,status){const e=new Error(message);e.code=code;e.statusCode=status||400;return e;}
function clean(v,n){return String(v==null?"":v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").trim().slice(0,n);}
function validate(body){
 if(!body||typeof body!=="object"||Array.isArray(body))throw error("INVALID_BODY","بيانات الإعلان غير صالحة.");
 const title=clean(body.title||body.name,120),category=clean(body.category||body.cat,32),productType=clean(body.productType||"other",32),listingType=clean(body.listingType||"sale",16),condition=clean(body.condition||"unknown",16),currency=clean(body.currency||"YER",8);
 const governorate=clean(body.governorate||body.gov,80),deadline=clean(body.deadline,10),latitude=body.latitude==null||body.latitude===""?null:Number(body.latitude),longitude=body.longitude==null||body.longitude===""?null:Number(body.longitude);
 if(!title)throw error("TITLE_REQUIRED","اسم الإعلان مطلوب.");
 if(!CATEGORIES.has(category))throw error("INVALID_CATEGORY","القسم المحدد غير معروف.");
 if(governorate&&!GOVERNORATES.has(governorate))throw error("INVALID_GOVERNORATE","اختر محافظة يمنية من القائمة.");
 if(!PRODUCT_TYPES.has(productType))throw error("INVALID_PRODUCT_TYPE","نوع المعروض غير معروف.");
 if(!LISTING_TYPES.has(listingType))throw error("INVALID_LISTING_TYPE","نوع الإعلان غير معروف.");
 if(!CONDITIONS.has(condition))throw error("INVALID_CONDITION","حالة المعروض غير معروفة.");
 if(!CURRENCIES.has(currency))throw error("INVALID_CURRENCY","العملة غير معروفة.");
 if(category!=="souq"&&category!=="land"&&productType!=="other")throw error("INVALID_PRODUCT_TYPE","نوع المنتج مخصص لإعلانات السوق.");
 if(listingType==="rent"&&!["land","property","apartment","house","car","motorcycle"].includes(productType))throw error("INVALID_LISTING_TYPE","خيار الإيجار مخصص للعقارات والشقق والمنازل والسيارات والدراجات.");
 if(deadline&&category!=="jobs")throw error("INVALID_DEADLINE","تاريخ الانتهاء مخصص للوظائف.");
 if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||Number.isNaN(Date.parse(deadline+"T00:00:00Z"))))throw error("INVALID_DEADLINE","تاريخ الانتهاء غير صالح.");
 if((latitude===null)!==(longitude===null))throw error("INVALID_COORDINATES","أرسل خط العرض وخط الطول معاً.");
 if(latitude!==null&&(!Number.isFinite(latitude)||latitude < -90||latitude>90))throw error("INVALID_COORDINATES","خط العرض غير صالح.");
 if(longitude!==null&&(!Number.isFinite(longitude)||longitude < -180||longitude>180))throw error("INVALID_COORDINATES","خط الطول غير صالح.");
  let openingHours=clean(body.openingHours||body.hours,120),website=clean(body.website,320);
  if(website){
   let parsed;
    const hasHttpPrefix=website.toLowerCase().startsWith("http://")||website.toLowerCase().startsWith("https://");
    const hasExplicitScheme=/^[a-z][a-z0-9+.-]*:/i.test(website);
    if(hasExplicitScheme&&!hasHttpPrefix)throw error("INVALID_WEBSITE","يجب أن يبدأ رابط الموقع بـ http أو https.");
    try{parsed=new URL(hasHttpPrefix?website:"https://"+website);}
   catch(_){throw error("INVALID_WEBSITE","رابط الموقع الإلكتروني غير صالح.");}
   if(!["http:","https:"].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw error("INVALID_WEBSITE","يجب أن يبدأ رابط الموقع بـ http أو https.");
   website=parsed.href;
  }
  let image=String(body.imageData||body.img||body.imageUrl||body.image_url||"");
 if(/^https:\/\//i.test(image)){
  let parsedImage;
  try{parsedImage=new URL(image);}catch(_){throw error("INVALID_IMAGE","صيغة الصورة غير مدعومة.");}
  if(parsedImage.protocol!=="https:"||parsedImage.username||parsedImage.password||image.length>2048)
   throw error("INVALID_IMAGE","رابط الصورة يجب أن يكون HTTPS عاماً ومن دون بيانات دخول.");
  image=parsedImage.href;
 }else{
  if(image.length>400000)throw error("IMAGE_TOO_LARGE","حجم الصورة أكبر من الحد المسموح.",413);
  if(image&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw error("INVALID_IMAGE","صيغة الصورة غير مدعومة.");
 }
 return {id:crypto.randomUUID(),clientRef:clean(body.clientRef||body.client_ref,100)||null,title,category,productType:(category==="souq"||category==="land")?productType:"other",listingType,condition,governorate,district:clean(body.district||body.dist,100),area:clean(body.area,120),village:clean(body.village,120),country:clean(body.country||"اليمن",80),description:clean(body.description||body.desc,1800),phone:clean(body.phone,50),openingHours,website,sellerName:clean(body.sellerName,100),price:clean(body.price,80),currency,image,latitude,longitude,deadline:deadline||null};
}
function send(res,status,payload){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(payload));}
function limit(req,key,max,windowMs){const ip=String(req.headers["x-forwarded-for"]||req.socket&&req.socket.remoteAddress||"unknown").split(",")[0].trim(),k=key+":"+ip,now=Date.now(),times=(buckets.get(k)||[]).filter(t=>now-t<windowMs);if(times.length>=max){buckets.set(k,times);return false;}times.push(now);buckets.set(k,times);if(buckets.size>4000)for(const [id,arr] of buckets)if(!arr.length||now-arr[arr.length-1]>3600000)buckets.delete(id);return true;}
function body(req,max){return new Promise((resolve,reject)=>{const chunks=[];let size=0,oversized=false;req.on("data",c=>{size+=c.length;if(size>max){oversized=true;chunks.length=0;}else if(!oversized)chunks.push(Buffer.from(c));});req.on("end",()=>{if(oversized)return reject(error("BODY_TOO_LARGE","حجم الطلب أكبر من الحد المسموح.",413));try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"));}catch(_){reject(error("INVALID_JSON","تعذر قراءة بيانات الطلب."));}});req.on("error",reject);});}
function getPool(){if(!process.env.DATABASE_URL)throw error("DATABASE_NOT_CONFIGURED","قاعدة بيانات دليلنا المشتركة لم تُربط بعد.",503);if(pool)return pool;if(poolError)throw poolError;try{const {Pool}=require("pg"),u=new URL(process.env.DATABASE_URL),ssl=u.searchParams.get("sslmode")==="require"||process.env.DATABASE_SSL==="true";pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:7000,ssl:ssl?{rejectUnauthorized:false}:undefined,application_name:"dalilna-marketplace"});pool.on("error",e=>console.error(JSON.stringify({event:"marketplace.pool.error",code:clean(e.code,40)})));return pool;}catch(_){poolError=error("DATABASE_DRIVER_MISSING","مكتبة PostgreSQL غير مثبتة.",503);throw poolError;}}
async function schema(db){
 if(!schemaPromise){
  schemaPromise=(async()=>{
   const r=await db.query("SELECT to_regclass('public.marketplace_listings') AS listings,to_regclass('public.marketplace_moderation_log') AS moderation");
   if(!r.rows[0]||!r.rows[0].listings||!r.rows[0].moderation)throw error("DATABASE_SCHEMA_MISSING","جداول السوق المشترك لم تُنشأ بعد.",503);
   await db.query("ALTER TABLE marketplace_listings ALTER COLUMN expires_at DROP NOT NULL");
   await db.query(`CREATE TABLE IF NOT EXISTS marketplace_ugc_reports (
     id UUID PRIMARY KEY,
     report_type VARCHAR(16) NOT NULL CHECK(report_type IN ('listing','seller','assistant')),
     listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
     reason VARCHAR(32) NOT NULL,
     details VARCHAR(800) NOT NULL DEFAULT '',
     content_snapshot VARCHAR(4000) NOT NULL DEFAULT '',
     status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','dismissed','resolved','actioned')),
     resolution_note VARCHAR(500) NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     reviewed_at TIMESTAMPTZ
   )`);
   await db.query("CREATE INDEX IF NOT EXISTS marketplace_ugc_reports_pending_idx ON marketplace_ugc_reports(status,created_at DESC)");
   await db.query(`CREATE TABLE IF NOT EXISTS marketplace_seller_blocks (
     phone_hash CHAR(64) PRIMARY KEY,
     reason VARCHAR(500) NOT NULL DEFAULT '',
     source_listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`);
  })().catch(e=>{schemaPromise=null;throw e;});
 }
 return schemaPromise;
}
function normalizedSellerPhone(value){
 let digits=String(value||"").replace(/\\D/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 if(digits.startsWith("967")&&digits.length===12)digits=digits.slice(3);
 if(digits.startsWith("0")&&digits.length===10)digits=digits.slice(1);
 return digits.length>=9&&digits.length<=15?digits:"";
}
function sellerFingerprint(value){
 const phone=normalizedSellerPhone(value),key=String(process.env.DALILNA_ADMIN_TOKEN||"");
 if(!phone)return "";
 if(key.length<32)throw error("ADMIN_TOKEN_NOT_CONFIGURED","تعذر تفعيل حظر البائعين على الخادم.",503);
 return crypto.createHmac("sha256",key).update(phone).digest("hex");
}
async function submitUgcReport(req,res){
 if(!limit(req,"ugc-report",5,60*60*1000))return send(res,429,{ok:false,error:"وصلت إلى الحد المؤقت للبلاغات. حاول لاحقاً."});
 const b=await body(req,10000),reportType=clean(b.reportType,16),reason=clean(b.reason,32);
 const allowedTypes=new Set(["listing","seller","assistant"]);
 const allowedReasons=new Set(["spam","scam","prohibited","harassment","fake","unsafe","other"]);
 if(!allowedTypes.has(reportType)||!allowedReasons.has(reason))throw error("INVALID_REPORT","نوع البلاغ أو سببه غير صالح.");
 const details=clean(b.details,800),snapshot=clean(b.contentSnapshot,4000);
 let listingId=clean(b.listingId,50);
 if(reportType==="assistant"){
  if(!snapshot)throw error("REPORT_CONTENT_REQUIRED","أرسل جزءاً من الرد حتى تتم مراجعته.");
  listingId="";
 }else{
  if(!/^[0-9a-f-]{36}$/i.test(listingId))throw error("INVALID_LISTING_ID","معرّف الإعلان غير صالح.");
 }
 const db=getPool();await schema(db);
 let listing=null;
 if(listingId){
  const found=await db.query("SELECT id,title,phone,status FROM marketplace_listings WHERE id=$1",[listingId]);
  if(!found.rows.length)throw error("LISTING_NOT_FOUND","الإعلان غير موجود.",404);
  listing=found.rows[0];
 }
 const id=crypto.randomUUID();
 await db.query(
  "INSERT INTO marketplace_ugc_reports(id,report_type,listing_id,reason,details,content_snapshot) VALUES($1,$2,$3,$4,$5,$6)",
  [id,reportType,listingId||null,reason,details,snapshot]
 );
 console.info(JSON.stringify({event:"marketplace.ugc_report.created",id,reportType,reason}));
 return send(res,201,{ok:true,id,status:"pending",message:"تم إرسال البلاغ إلى فريق المراجعة."});
}
async function adminUgcReports(req,res){
 admin(req);
 if(!limit(req,"admin-reports",60,60000))return send(res,429,{ok:false,error:"طلبات كثيرة. حاول لاحقاً."});
 const db=getPool();await schema(db);
 const r=await db.query(
  "SELECT r.id,r.report_type,r.listing_id,r.reason,r.details,r.content_snapshot,r.status,r.created_at,l.title AS listing_title,l.phone AS seller_phone,l.seller_name,l.status AS listing_status FROM marketplace_ugc_reports r LEFT JOIN marketplace_listings l ON l.id=r.listing_id WHERE r.status='pending' ORDER BY r.created_at ASC LIMIT 100"
 );
 return send(res,200,{ok:true,items:r.rows.map(row=>({
  id:row.id,reportType:row.report_type,listingId:row.listing_id,reason:row.reason,details:row.details,
  contentSnapshot:row.content_snapshot,status:row.status,createdAt:row.created_at,
  listingTitle:row.listing_title,sellerPhone:row.seller_phone,sellerName:row.seller_name,listingStatus:row.listing_status
 })),count:r.rows.length});
}
async function reviewUgcReport(req,res){
 admin(req);
 const b=await body(req,4000),id=clean(b.id,50),decision=clean(b.decision,24),note=clean(b.note,500);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!["dismiss","remove_listing","block_seller","resolve"].includes(decision))throw error("INVALID_REPORT_REVIEW","قرار مراجعة البلاغ غير صالح.");
 const db=getPool();await schema(db);const client=await db.connect();
 try{
  await client.query("BEGIN");
  const found=await client.query(
   "SELECT r.id,r.report_type,r.listing_id,l.phone AS seller_phone FROM marketplace_ugc_reports r LEFT JOIN marketplace_listings l ON l.id=r.listing_id WHERE r.id=$1 AND r.status='pending' FOR UPDATE OF r",
   [id]
  );
  if(!found.rows.length){await client.query("ROLLBACK");return send(res,404,{ok:false,error:"البلاغ غير موجود أو تمت مراجعته."});}
  const report=found.rows[0];
  let result="dismissed";
  if(decision==="remove_listing"){
   if(!report.listing_id)throw error("LISTING_REQUIRED","هذا البلاغ لا يرتبط بإعلان.");
   await client.query("UPDATE marketplace_listings SET status='archived',updated_at=NOW() WHERE id=$1",[report.listing_id]);
   result="actioned";
  }else if(decision==="block_seller"){
   if(report.report_type!=="seller"||!report.seller_phone)throw error("SELLER_REQUIRED","هذا البلاغ لا يحتوي على بيانات بائع قابلة للحظر.");
   const digits=normalizedSellerPhone(report.seller_phone);
   if(!digits)throw error("SELLER_PHONE_INVALID","رقم البائع غير صالح للحظر.");
   const fingerprint=sellerFingerprint(report.seller_phone);
   await client.query(
    "INSERT INTO marketplace_seller_blocks(phone_hash,reason,source_listing_id) VALUES($1,$2,$3) ON CONFLICT(phone_hash) DO UPDATE SET reason=EXCLUDED.reason,source_listing_id=EXCLUDED.source_listing_id",
    [fingerprint,note||"تم الحظر بعد مراجعة بلاغ مستخدم",report.listing_id]
   );
   await client.query(
    "UPDATE marketplace_listings SET status='archived',updated_at=NOW() WHERE regexp_replace(phone,'[^0-9]','','g')=ANY($1::text[])",
    [[digits,"967"+digits,"00967"+digits,"0"+digits]]
   );
   result="actioned";
  }else if(decision==="resolve"){
   result="resolved";
  }
  await client.query("UPDATE marketplace_ugc_reports SET status=$2,resolution_note=$3,reviewed_at=NOW() WHERE id=$1",[id,result,note]);
  await client.query("COMMIT");
  return send(res,200,{ok:true,id,status:result});
 }catch(e){try{await client.query("ROLLBACK");}catch(_){}throw e;}
 finally{client.release();}
}
function admin(req){const expected=String(process.env.DALILNA_ADMIN_TOKEN||""),auth=String(req.headers.authorization||""),token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";if(!expected||!token)throw error("ADMIN_AUTH_REQUIRED","يلزم رمز إدارة الخادم.",401);const a=Buffer.from(expected),b=Buffer.from(token);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw error("ADMIN_AUTH_FAILED","رمز الإدارة غير صحيح.",403);}
function map(row,withImage){const o={id:row.id,clientRef:row.client_ref,title:row.title,category:row.category,productType:row.product_type,listingType:row.listing_type,condition:row.condition,governorate:row.governorate,district:row.district,area:row.area,village:row.village,country:row.country,description:row.description,phone:row.phone,openingHours:row.opening_hours||"",website:row.website||"",sellerName:row.seller_name,price:row.price,currency:row.currency,latitude:row.latitude,longitude:row.longitude,deadline:row.deadline?String(row.deadline).slice(0,10):"",status:row.status,submittedAt:row.created_at,approvedAt:row.approved_at,updatedAt:row.updated_at,expiresAt:row.expires_at||null};if(withImage&&row.image_data)o.imageData=row.image_data;return o;}
async function status(res){if(!process.env.DATABASE_URL)return send(res,200,{ok:true,ready:false,databaseConfigured:false});try{const db=getPool();await schema(db);return send(res,200,{ok:true,ready:true,databaseConfigured:true});}catch(e){return send(res,e.statusCode||503,{ok:false,ready:false,databaseConfigured:true,code:e.code||"DATABASE_UNAVAILABLE",error:e.message});}}
async function counts(req,res){
 if(!limit(req,"counts",60,60000))return send(res,429,{ok:false,error:"طلبات كثيرة. انتظر قليلاً."});
 const db=getPool();await schema(db);
 const result=await db.query("SELECT governorate,category,COUNT(*)::int AS total FROM marketplace_listings WHERE status='approved' AND (expires_at IS NULL OR expires_at>NOW()) AND (category<>'jobs' OR deadline IS NULL OR deadline>=CURRENT_DATE) GROUP BY governorate,category");
 const all={},governorates={};
 for(const row of result.rows){
  const category=clean(row.category,32),governorate=clean(row.governorate,80),total=Number(row.total||0);
  if(!category)continue;
  all[category]=(all[category]||0)+total;
  if(governorate){if(!governorates[governorate])governorates[governorate]={};governorates[governorate][category]=(governorates[governorate][category]||0)+total;}
 }
 return send(res,200,{ok:true,counts:{all,governorates},fetchedAt:new Date().toISOString()});
}
async function list(req,res,url){if(!limit(req,"list",45,60000))return send(res,429,{ok:false,error:"طلبات كثيرة. انتظر قليلاً."});const db=getPool();await schema(db);const where=["status='approved'","(expires_at IS NULL OR expires_at>NOW())","(category<>'jobs' OR deadline IS NULL OR deadline>=CURRENT_DATE)"],params=[];function add(sql,val){params.push(val);where.push(sql.replace("?", "$"+params.length));}
 const cat=clean(url.searchParams.get("category"),32),type=clean(url.searchParams.get("productType"),32),group=clean(url.searchParams.get("productGroup"),32),listingType=clean(url.searchParams.get("listingType"),16),gov=clean(url.searchParams.get("governorate"),80),dist=clean(url.searchParams.get("district"),100),q=clean(url.searchParams.get("q"),100).replace(/[%_]/g,"");
 if(cat==="marketplace")where.push("category IN ('souq','land')");else if(cat&&cat!=="all"&&CATEGORIES.has(cat))add("category = ?",cat);
 if(type&&type!=="all"&&PRODUCT_TYPES.has(type))add("product_type = ?",type);
 if(group&&PRODUCT_GROUPS[group]){params.push(PRODUCT_GROUPS[group]);where.push("product_type = ANY($"+params.length+"::text[])");}
 if(listingType&&LISTING_TYPES.has(listingType))add("listing_type = ?",listingType);
 if(gov&&GOVERNORATES.has(gov))add("governorate = ?",gov);
 if(dist)add("district ILIKE ?","%"+dist+"%");
 if(q){const pat="%"+q+"%";params.push(pat,pat,pat,pat);const n=params.length-3;where.push("(title ILIKE $"+n+" OR description ILIKE $"+(n+1)+" OR district ILIKE $"+(n+2)+" OR area ILIKE $"+(n+3)+")");}
 const max=Math.min(24,Math.max(1,Number(url.searchParams.get("limit"))||24)),offset=Math.min(500,Math.max(0,Number(url.searchParams.get("offset"))||0));params.push(max);const lp=params.length;params.push(offset);const op=params.length;const images=url.searchParams.get("includeImages")==="1",col=images?"image_data":"''::text AS image_data";
 const sql="SELECT id,client_ref,title,category,product_type,listing_type,condition,governorate,district,area,village,country,description,phone,opening_hours,website,seller_name,price,currency,"+col+",latitude,longitude,deadline,status,created_at,approved_at,updated_at,expires_at,COUNT(*) OVER() AS total_count FROM marketplace_listings WHERE "+where.join(" AND ")+" ORDER BY created_at DESC LIMIT $"+lp+" OFFSET $"+op;
 const r=await db.query(sql,params);return send(res,200,{ok:true,items:r.rows.map(x=>map(x,images)),count:r.rows.length?Number(r.rows[0].total_count):0,fetchedAt:new Date().toISOString(),refreshAfterSeconds:120,limit:max,offset});
}
async function submit(req,res){
 if(!limit(req,"submit",60,3600000))return send(res,429,{ok:false,error:"وصلت إلى حد الإعلانات المؤقت."});
 const requestBody=await body(req,450000);
 if(requestBody.termsAccepted!==true)throw error("TERMS_REQUIRED","يجب الموافقة على شروط المحتوى قبل إرسال الإعلان.");
 const item=validate(requestBody),db=getPool();await schema(db);
 if(item.phone){
  const fingerprint=sellerFingerprint(item.phone);
  const blocked=await db.query("SELECT 1 FROM marketplace_seller_blocks WHERE phone_hash=$1",[fingerprint]);
  if(blocked.rows.length)throw error("SELLER_BLOCKED","لا يمكن استقبال إعلانات جديدة من هذا البائع.",403);
 }
 if(item.clientRef){const existing=await db.query("SELECT id,status FROM marketplace_listings WHERE client_ref=$1",[item.clientRef]);if(existing.rows.length)return send(res,200,{ok:true,duplicate:true,id:existing.rows[0].id,status:existing.rows[0].status});}
  const sql="INSERT INTO marketplace_listings (id,client_ref,title,category,product_type,listing_type,condition,governorate,district,area,village,country,description,phone,opening_hours,website,seller_name,price,currency,image_data,latitude,longitude,deadline,status,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'pending',NULL) ON CONFLICT(client_ref) DO NOTHING RETURNING id";
 const values=[item.id,item.clientRef,item.title,item.category,item.productType,item.listingType,item.condition,item.governorate,item.district,item.area,item.village,item.country,item.description,item.phone,item.openingHours,item.website,item.sellerName,item.price,item.currency,item.image,item.latitude,item.longitude,item.deadline,item.deadline],r=await db.query(sql,values);
 if(!r.rows.length)return send(res,200,{ok:true,duplicate:true,status:"pending"});
 console.info(JSON.stringify({event:"marketplace.submitted",id:r.rows[0].id,category:item.category}));return send(res,201,{ok:true,id:r.rows[0].id,status:"pending",message:"وصل إعلانك إلى الإدارة. سيظهر بعد المراجعة."});
}
async function pending(req,res){admin(req);if(!limit(req,"admin",60,60000))return send(res,429,{ok:false,error:"طلبات مراجعة كثيرة."});const db=getPool();await schema(db);const r=await db.query("SELECT id,client_ref,title,category,product_type,listing_type,condition,governorate,district,area,village,country,description,phone,opening_hours,website,seller_name,price,currency,image_data,latitude,longitude,deadline,status,created_at,approved_at,updated_at FROM marketplace_listings WHERE status='pending' ORDER BY created_at ASC LIMIT 100");return send(res,200,{ok:true,items:r.rows.map(x=>map(x,true)),count:r.rows.length});}
async function review(req,res){admin(req);const b=await body(req,12000),id=clean(b.id,50),decision=clean(b.decision,16),note=clean(b.note,500);if(!/^[0-9a-f-]{36}$/i.test(id)||!["approve","reject"].includes(decision))throw error("INVALID_REVIEW","قرار المراجعة غير صالح.");const db=getPool();await schema(db);const c=await db.connect();try{await c.query("BEGIN");const status=decision==="approve"?"approved":"rejected";const r=await c.query("UPDATE marketplace_listings SET status=$2,review_note=$3,approved_at=CASE WHEN $2='approved' THEN NOW() ELSE NULL END,expires_at=CASE WHEN $2<>'approved' THEN NULL WHEN category IN ('souq','land') THEN NOW()+INTERVAL '60 days' WHEN category='jobs' AND deadline IS NOT NULL THEN LEAST(NOW()+INTERVAL '60 days',deadline+INTERVAL '1 day') WHEN category='jobs' THEN NOW()+INTERVAL '60 days' ELSE NULL END,updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,title,category,status,approved_at,expires_at",[id,status,note]);if(!r.rows.length){await c.query("ROLLBACK");return send(res,404,{ok:false,error:"الإعلان غير موجود أو تمت مراجعته."});}await c.query("INSERT INTO marketplace_moderation_log(listing_id,action,note) VALUES($1,$2,$3)",[id,status,note]);await c.query("COMMIT");return send(res,200,{ok:true,item:r.rows[0]});}catch(e){try{await c.query("ROLLBACK");}catch(_){}throw e;}finally{c.release();}}
async function syncMerchantFeed(req,res){
 const expected=String(process.env.DALILNA_PRODUCT_SYNC_TOKEN||"");
 const authorization=String(req.headers.authorization||"");
 const supplied=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
 if(expected.length<32)throw error("PRODUCT_SYNC_NOT_CONFIGURED","مزامنة منتجات التجار غير مهيأة على الخادم.",503);
 const expectedBytes=Buffer.from(expected),suppliedBytes=Buffer.from(supplied);
 if(expectedBytes.length!==suppliedBytes.length||!crypto.timingSafeEqual(expectedBytes,suppliedBytes))throw error("PRODUCT_SYNC_AUTH_FAILED","رمز مزامنة المنتجات غير صحيح.",403);
 if(!limit(req,"product-feed-sync",30,3600000))throw error("PRODUCT_SYNC_RATE_LIMIT","طلبات مزامنة كثيرة.",429);
 const payload=await body(req,2500000),items=Array.isArray(payload.items)?payload.items:[];
 const sourceKey=clean(payload.sourceKey,50).toLowerCase().replace(/[^a-z0-9_-]/g,"");
 const sourceName=clean(payload.sourceName||sourceKey,100);
 const completeSnapshot=payload.completeSnapshot===true;
 const activeClientRefs=Array.isArray(payload.activeClientRefs)
  ? [...new Set(payload.activeClientRefs.map(value=>clean(value,100)).filter(value=>value.startsWith("feed:")&&value.length>=10&&value.length<=100))]
  : [];
 if(!sourceKey||items.length===0||items.length>250)throw error("INVALID_PRODUCT_FEED","خلاصة المنتجات فارغة أو غير صالحة.");
 if(completeSnapshot&&!activeClientRefs.length)throw error("INVALID_PRODUCT_SNAPSHOT","لا يمكن اعتماد لقطة كاملة من دون قائمة المنتجات النشطة.");
 const db=getPool();await schema(db);const client=await db.connect();
 let inserted=0,updated=0,skipped=0;const activeRefs=[];
 try{
  await client.query("BEGIN");
  for(const raw of items){
   try{
    const suppliedRef=clean(raw.clientRef,100);
    const clientRef=suppliedRef.startsWith("feed:")?suppliedRef:"feed:"+sourceKey+":"+clean(raw.id,80).replace(/[^a-zA-Z0-9._:-]/g,"-");
    if(clientRef.length<10||clientRef.length>100||!raw.phone||!raw.sellerName)throw new Error("seller contact missing");
    const item=validate({...raw,category:"souq",clientRef,country:"اليمن",listingType:raw.listingType||"sale",condition:raw.condition||"unknown"});
    if(!item.governorate||!item.district)throw new Error("location missing");
    const sql="INSERT INTO marketplace_listings (id,client_ref,title,category,product_type,listing_type,condition,governorate,district,area,village,country,description,phone,opening_hours,website,seller_name,price,currency,image_data,latitude,longitude,deadline,status,approved_at,review_note,expires_at) VALUES ($1,$2,$3,'souq',$4,$5,$6,$7,$8,$9,$10,'اليمن',$11,$12,'',$13,$14,$15,$16,$17,$18,$19,NULL,'approved',NOW(),$20,NOW()+INTERVAL '60 days') ON CONFLICT(client_ref) DO UPDATE SET title=EXCLUDED.title,product_type=EXCLUDED.product_type,listing_type=EXCLUDED.listing_type,condition=EXCLUDED.condition,governorate=EXCLUDED.governorate,district=EXCLUDED.district,area=EXCLUDED.area,village=EXCLUDED.village,description=EXCLUDED.description,phone=EXCLUDED.phone,website=EXCLUDED.website,seller_name=EXCLUDED.seller_name,price=EXCLUDED.price,currency=EXCLUDED.currency,image_data=EXCLUDED.image_data,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,review_note=EXCLUDED.review_note,status='approved',approved_at=NOW(),updated_at=NOW(),expires_at=CASE WHEN marketplace_listings.status='archived' AND marketplace_listings.review_note LIKE 'merchant_feed:%' THEN NOW()+INTERVAL '60 days' ELSE marketplace_listings.expires_at END WHERE marketplace_listings.client_ref LIKE 'feed:%' AND marketplace_listings.status IN ('approved','archived') RETURNING (xmax=0) AS inserted";
    const values=[item.id,item.clientRef,item.title,item.productType,item.listingType,item.condition,item.governorate,item.district,item.area,item.village,item.description,item.phone,item.website,item.sellerName,item.price,item.currency,item.image,item.latitude,item.longitude,"merchant_feed:"+sourceName];
    const result=await client.query(sql,values);
    if(!result.rows.length)skipped++;
    else{
     activeRefs.push(item.clientRef);
     if(result.rows[0].inserted)inserted++;
     else updated++;
    }
   }catch(_){skipped++;}
  }
  let archived=0;
  if(completeSnapshot&&skipped===0&&activeClientRefs.length>0&&activeRefs.length===activeClientRefs.length&&activeRefs.every(ref=>activeClientRefs.includes(ref))){
   const stale=await client.query("UPDATE marketplace_listings SET status='archived',expires_at=NOW(),updated_at=NOW() WHERE client_ref LIKE 'feed:%' AND status='approved' AND NOT (client_ref=ANY($1::text[])) RETURNING id",[activeClientRefs]);
   archived=stale.rowCount||0;
  }
  await client.query("COMMIT");
  console.info(JSON.stringify({event:"marketplace.feed_sync",source:sourceName,received:items.length,inserted,updated,skipped,archived}));
  return send(res,200,{ok:true,source:sourceName,received:items.length,inserted,updated,skipped,archived,completeSnapshot,archivedFromSnapshot:completeSnapshot&&archived>0,fetchedAt:new Date().toISOString()});
 }catch(e){await client.query("ROLLBACK");throw e;}
 finally{client.release();}
}
async function handleMarketplaceRequest(req,res,url){
 if(!url.pathname.startsWith("/api/marketplace/"))return false;
 try{
  const r=url.pathname.slice("/api/marketplace/".length);
  if(r==="status"&&req.method==="GET")await status(res);
  else if(r==="counts"&&req.method==="GET")await counts(req,res);
  else if(r==="listings"&&req.method==="GET")await list(req,res,url);
  else if(r==="listings"&&req.method==="POST")await submit(req,res);
  else if(r==="reports"&&req.method==="POST")await submitUgcReport(req,res);
  else if(r==="feed-sync"&&req.method==="POST")await syncMerchantFeed(req,res);
  else if(r==="admin/pending"&&req.method==="GET")await pending(req,res);
  else if(r==="admin/review"&&req.method==="POST")await review(req,res);
  else if(r==="admin/reports"&&req.method==="GET")await adminUgcReports(req,res);
  else if(r==="admin/report-review"&&req.method==="POST")await reviewUgcReport(req,res);
  else send(res,404,{ok:false,error:"المسار غير موجود."});
 }catch(e){send(res,e.statusCode||500,{ok:false,code:e.code||"INTERNAL_ERROR",error:clean(e.message,240)||"تعذر تنفيذ الطلب."});}
 return true;
}
module.exports={handleMarketplaceRequest,validate,CATEGORIES,PRODUCT_TYPES,GOVERNORATES,PRODUCT_GROUPS};
