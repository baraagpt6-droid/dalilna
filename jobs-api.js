"use strict";
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const { isSellerPhoneBlocked } = require("./marketplace-api");
const {URL}=require("node:url");
const {getClientIp}=require("./client-ip");
const COUNTRIES=new Set(["Yemen","Saudi Arabia","United Arab Emirates","Oman","Qatar","Bahrain","Iraq","Jordan"]);
const COUNTRY_CODES={YE:"Yemen",SA:"Saudi Arabia",AE:"United Arab Emirates",OM:"Oman",QA:"Qatar",BH:"Bahrain",IQ:"Iraq",JO:"Jordan"};
let pool=null;
const buckets=new Map();
function clean(value,max=160){return String(value==null?"":value).replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function send(res,status,payload){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(payload));}
function limit(req,key,max,windowMs){const ip=getClientIp(req),k=key+":"+ip,now=Date.now(),times=(buckets.get(k)||[]).filter(t=>now-t<windowMs);if(times.length>=max){buckets.set(k,times);return false;}times.push(now);buckets.set(k,times);if(buckets.size>3000)for(const [id,arr] of buckets)if(!arr.length||now-arr[arr.length-1]>3600000)buckets.delete(id);return true;}
function getPool(){if(!process.env.DATABASE_URL){const e=new Error("قاعدة بيانات دليلنا غير مهيأة على الخادم.");e.statusCode=503;throw e;}if(pool)return pool;const {Pool}=require("pg");const u=new URL(process.env.DATABASE_URL),ssl=u.searchParams.get("sslmode")==="require"||process.env.DATABASE_SSL==="true";pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:7000,ssl:ssl?{rejectUnauthorized:false}:undefined,application_name:"dalilna-jobs"});pool.on("error",e=>console.error(JSON.stringify({event:"jobs.pool.error",code:clean(e.code,40)})));return pool;}
const JOB_FEED_URL="https://raw.githubusercontent.com/baraagpt6-droid/dalilna/main/jobs-feed.json";
const FEED_CACHE_TTL_MS=90_000;
const FEED_FETCH_TIMEOUT_MS=4_000;
const feedCache={value:null,at:0,pending:null};
function normalizeFeed(data){
 const items=Array.isArray(data?.items)?data.items:[];
 return {
  fetchedAt:data?.fetchedAt||null,
  sources:Array.isArray(data?.sources)?data.sources:[],
  items:items.filter(item=>item&&item.title&&typeof item.title==="string"&&
   typeof item.url==="string"&&/^https:\/\//i.test(item.url)&&
   (!item.expiresAt||Date.parse(item.expiresAt)>Date.now()))
 };
}
function readLocalFeed(){
 try{return normalizeFeed(JSON.parse(fs.readFileSync(path.join(__dirname,"jobs-feed.json"),"utf8")));}
 catch(_){return {fetchedAt:null,sources:[],items:[]};}
}
async function readFeed(fetchImpl=global.fetch,force=false){
 const now=Date.now();
 if(!force&&feedCache.value&&now-feedCache.at<FEED_CACHE_TTL_MS)return feedCache.value;
 if(!force&&feedCache.pending)return feedCache.pending;
 const request=(async()=>{
  try{
   if(typeof fetchImpl!=="function")throw new Error("Fetch API is unavailable.");
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),FEED_FETCH_TIMEOUT_MS);
   let response;
   try{
    response=await fetchImpl(JOB_FEED_URL,{
     method:"GET",cache:"no-store",signal:controller.signal,
     headers:{Accept:"application/json","Cache-Control":"no-cache"}
    });
   }finally{clearTimeout(timer);}
   if(!response.ok)throw new Error("Public jobs feed returned HTTP "+response.status);
   const data=await response.json();
   if(!data||data.schemaVersion!==1||!Array.isArray(data.items))throw new Error("Public jobs feed has an invalid schema.");
   const normalized=normalizeFeed(data);
   feedCache.value=normalized;feedCache.at=Date.now();
   return normalized;
  }catch(error){
   if(feedCache.value)return feedCache.value;
   const local=readLocalFeed();
   feedCache.value=local;feedCache.at=Date.now();
   console.warn(JSON.stringify({event:"jobs.feed.remote_fallback",message:clean(error.message,160)}));
   return local;
  }
 })();
 if(!force)feedCache.pending=request;
 try{return await request;}
 finally{if(feedCache.pending===request)feedCache.pending=null;}
}
function asCountry(value){const s=clean(value,80);return COUNTRY_CODES[s.toUpperCase()]||s;}
function validPhone(value){const digits=String(value||"").replace(/\D/g,"");return digits.length>=9&&digits.length<=15?digits:"";}
function readJson(req,max){return new Promise((resolve,reject)=>{const parts=[];let size=0,failed=false;req.on("data",chunk=>{size+=chunk.length;if(size>max&&!failed){failed=true;reject(Object.assign(new Error("حجم الطلب أكبر من الحد المسموح."),{statusCode:413}));}else if(!failed)parts.push(Buffer.from(chunk));});req.on("end",()=>{if(failed)return;try{resolve(JSON.parse(Buffer.concat(parts).toString("utf8")||"{}"));}catch(_){reject(Object.assign(new Error("بيانات التسجيل غير صالحة."),{statusCode:400}));}});req.on("error",reject);});}
async function listJobs(req,res,url){if(!limit(req,"jobs-feed",60,60000))return send(res,429,{ok:false,error:"طلبات كثيرة. حاول بعد قليل."});const feed=await readFeed(),raw=clean(url.searchParams.get("country"),80),country=asCountry(raw),items=!raw||raw==="all"?feed.items:feed.items.filter(x=>x.country===country||x.countryCode===raw.toUpperCase());const max=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||60));return send(res,200,{ok:true,fetchedAt:feed.fetchedAt,sources:feed.sources,count:items.length,items:items.slice(0,max)});}
async function submitCandidate(req,res){
 if(!limit(req,"job-candidate-submit",5,3600000))return send(res,429,{ok:false,error:"وصلت إلى حد التسجيل المؤقت. حاول لاحقاً."});
 let body;try{body=await readJson(req,12000);}catch(e){return send(res,e.statusCode||400,{ok:false,error:e.message});}
 const name=clean(body.fullName||body.name,100),specialty=clean(body.specialty||body.profession,120),years=Number(body.experienceYears??body.experience),country=asCountry(body.country),governorate=clean(body.governorate||body.city,80),bio=clean(body.bio,800),phone=validPhone(body.whatsapp||body.phone),consent=body.consentPublic===true,termsAccepted=body.termsAccepted===true;
 if(name.length<2||specialty.length<2||!Number.isInteger(years)||years<0||years>60||!COUNTRIES.has(country)||!phone||bio.length<10||!consent||!termsAccepted)return send(res,400,{ok:false,error:"أكمل البيانات ووافق على عرض ملفك للعامة وشروط المحتوى قبل النشر."});
 try{
  if(await isSellerPhoneBlocked(phone))return send(res,403,{ok:false,error:"هذا الرقم محظور من النشر بعد مراجعة بلاغ. تواصل مع إدارة دليلنا للاعتراض."});
  const db=getPool(),id=crypto.randomUUID(),result=await db.query("INSERT INTO job_seekers (id,full_name,specialty,experience_years,country,governorate,bio,phone,consent_public,status,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,'approved',NOW()+INTERVAL '60 days') RETURNING id,created_at,expires_at",[id,name,specialty,years,country,governorate,bio,phone]);
  const row=result.rows[0];
  return send(res,201,{ok:true,id:row.id,createdAt:row.created_at,expiresAt:row.expires_at,message:"تم نشر ملفك بعد موافقتك. سيبقى ظاهراً لمدة 60 يوماً."});
 }catch(e){
  console.error(JSON.stringify({event:"jobs.candidate.submit.error",code:clean(e.code,40)}));
  return send(res,Number(e.statusCode)||503,{ok:false,error:"تعذر حفظ ملف الباحث عن عمل حالياً."});
 }
}
async function listCandidates(req,res,url){if(!limit(req,"job-candidates-list",45,60000))return send(res,429,{ok:false,error:"طلبات كثيرة. حاول بعد قليل."});try{const db=getPool(),raw=clean(url.searchParams.get("country"),80),country=asCountry(raw),params=[],where="status='approved' AND consent_public=TRUE AND expires_at>NOW()";let clause=where;if(raw&&raw!=="all"){params.push(country);clause+=" AND country=$1";}params.push(Math.min(80,Math.max(1,Number(url.searchParams.get("limit"))||60)));const result=await db.query("SELECT id,full_name,specialty,experience_years,country,governorate,bio,phone,created_at,expires_at FROM job_seekers WHERE "+clause+" ORDER BY created_at DESC LIMIT $"+params.length,params);return send(res,200,{ok:true,count:result.rows.length,items:result.rows.map(row=>({id:row.id,fullName:row.full_name,specialty:row.specialty,experienceYears:Number(row.experience_years),country:row.country,governorate:row.governorate,bio:row.bio,whatsapp:row.phone,createdAt:row.created_at,expiresAt:row.expires_at}))});}catch(e){console.error(JSON.stringify({event:"jobs.candidates.list.error",code:clean(e.code,40)}));return send(res,Number(e.statusCode)||503,{ok:false,error:"تعذر تحميل الباحثين عن عمل حالياً."});}}
async function handleJobsRequest(req,res,url){if(url.pathname==="/api/jobs"&&req.method==="GET"){await listJobs(req,res,url);return true;}if(url.pathname==="/api/jobs/candidates"&&req.method==="GET"){await listCandidates(req,res,url);return true;}if(url.pathname==="/api/jobs/candidates"&&req.method==="POST"){await submitCandidate(req,res);return true;}if(url.pathname.startsWith("/api/jobs")){send(res,404,{ok:false,error:"مسار الوظائف غير موجود."});return true;}return false;}
module.exports={handleJobsRequest,readFeed,normalizeFeed,validPhone,COUNTRIES,COUNTRY_CODES};
