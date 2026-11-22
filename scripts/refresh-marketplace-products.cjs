"use strict";
const crypto=require("node:crypto");
const {PRODUCT_TYPES,GOVERNORATES,PRODUCT_GROUPS}=require("../marketplace-api");
const ADMIN_MANIFEST=require("../regional-catalog/manifest.json");

const MAX_FEEDS=20,MAX_ITEMS=5000,MAX_BATCH=200;
const CURRENCIES=new Set(["YER","SAR","USD","OMR","AED","other"]);
const ARABIC_REMAP={"أ":"ا","إ":"ا","آ":"ا","ٱ":"ا","ة":"ه","ى":"ي","ؤ":"و","ئ":"ي"};
function normalizePlace(value){
 return String(value||"").normalize("NFKC").toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
  .replace(/[أإآٱةىؤئ]/g,char=>ARABIC_REMAP[char]||char)
  .replace(/[^a-z0-9\u0600-\u06FF]+/g," ").trim().split(/\s+/)
  .map(token=>token.startsWith("ال")&&token.length>4?token.slice(2):token).join(" ");
}

const governorateAliases=new Map();
for(const row of ADMIN_MANIFEST.governorates||[]){
 const canonical=String(row.name||"").trim();
 for(const value of [canonical,row.nameEn,row.nameLocal]){
  const key=normalizePlace(value);
  if(key)governorateAliases.set(key,canonical);
 }
}
const districtAliases=new Map();
for(const row of ADMIN_MANIFEST.districtCounts||[]){
 const gov=normalizePlace(row.governorate),canonical=String(row.district||"").trim();
 for(const value of [canonical,row.districtEn,row.districtLocal]){
  const key=normalizePlace(value);
  if(gov&&key)districtAliases.set(gov+"|"+key,canonical);
 }
}
function canonicalLocation(governorate,district){
 const rawGov=String(governorate||"").trim(),rawDistrict=String(district||"").trim();
 const gov=governorateAliases.get(normalizePlace(rawGov))||(GOVERNORATES.has(rawGov)?rawGov:"");
 if(!gov)return null;
 const govKey=normalizePlace(gov),districtKey=normalizePlace(rawDistrict);
 const canonicalDistrict=districtAliases.get(govKey+"|"+districtKey);
 return canonicalDistrict?{governorate:gov,district:canonicalDistrict}:null;
}
const PRODUCT_TYPE_ALIASES={
 phone:["phone","smartphone","mobile","mobile_phone","جوال","هاتف","جوالات","هواتف"],
 computer:["computer","laptop","notebook","لابتوب","حاسوب","كمبيوتر"],
 screen:["screen","monitor","display","شاشة","شاشات"],
 car:["car","automobile","سيارة","سيارات"],
 motorcycle:["motorcycle","motorbike","دراجة نارية","دباب"],
 land:["land","plot","plot_of_land","أرض","اراضي","أراضي"],
 property:["property","real_estate","عقار","عقارات"],
 apartment:["apartment","flat","شقة"],
 house:["house","home","بيت","منزل"],
 solar_panel:["solar_panel","panel","لوح شمسي","ألواح شمسية"],
 battery:["battery","بطارية","بطاريات"],
 inverter:["inverter","انفرتر"],
 furniture:["furniture","اثاث","أثاث"],
 livestock:["livestock","cattle","sheep","goat","مواشي","أغنام"],
 agriculture:["agriculture","farm_product","زراعة","محاصيل"],
 clothing:["clothing","clothes","ملابس"],
 perfume:["perfume","fragrance","عطور"]
};
function canonicalProductType(value){
 const raw=String(value||"").trim().toLowerCase();
 if(PRODUCT_TYPES.has(raw))return raw;
 const key=normalizePlace(raw);
 for(const [type,aliases] of Object.entries(PRODUCT_TYPE_ALIASES))if(aliases.some(alias=>normalizePlace(alias)===key))return type;
 return "";
}
function canonicalCurrency(value){
 const raw=String(value||"YER").trim().toUpperCase();
 const aliases={"ريال":"YER","ريال يمني":"YER","YEMENI RIAL":"YER","YER":"YER","ريال سعودي":"SAR","SAUDI RIYAL":"SAR","SAR":"SAR","دولار":"USD","US DOLLAR":"USD","USD":"USD","OMR":"OMR","AED":"AED","OTHER":"other"};
 return aliases[raw]||"";
}
const LISTING_TYPES=new Set(["sale","wanted","barter","free","rent"]);
const CONDITIONS=new Set(["new","used","unknown"]);
const PRODUCT_GROUPS_ALLOWED=new Set(Object.keys(PRODUCT_GROUPS));
const BASE=String(process.env.DALILNA_API_BASE_URL||"https://dalilna-live.onrender.com").replace(/\/+$/,"");

function clean(value,max=1000){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function phoneNumber(value){
 let digits=String(value||"").replace(/\D/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 if(digits.length===9&&/^7/.test(digits))digits="967"+digits;
 if(digits.length===10&&digits.startsWith("0"))digits="967"+digits.slice(1);
 return digits.length>=10&&digits.length<=15?digits:"";
}
function validHttps(value){
 try{const url=new URL(String(value||""));return url.protocol==="https:"&&!url.username&&!url.password?url.href:"";}catch(_){return "";}
}
function sourceId(value){
 const url=new URL(value);
 const stable=url.origin+url.pathname+"?"+[...url.searchParams.keys()].filter(key=>!/(token|key|secret|auth|signature)/i.test(key)).sort().map(key=>key+"="+url.searchParams.get(key)).join("&");
 return crypto.createHash("sha256").update(stable).digest("hex").slice(0,16);
}
function validatePublicFeedUrl(value){
 let url;
 try{url=new URL(value);}catch(_){return null;}
 const host=url.hostname.toLowerCase().replace(/^\\[|\\]$/g,"");
 if(url.protocol!=="https:"||url.username||url.password||url.port&&url.port!=="443")return null;
 if(["localhost","localhost.localdomain","metadata.google.internal"].includes(host)||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))return null;
 if(require("node:net").isIP(host))return null;
 return url;
}
function isInactiveFeedItem(raw){
 const status=String(raw?.status||raw?.availability||"available").toLowerCase();
 return raw?.active===false||["sold","deleted","expired","inactive","unavailable","out_of_stock"].includes(status);
}
function mapFeedItem(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||isInactiveFeedItem(raw))return null;
 const title=clean(raw.title||raw.name||raw.product_name,120);
 const id=clean(raw.id||raw.sku||raw.product_id||raw.url,70);
 const productType=canonicalProductType(raw.productType||raw.product_type||raw.type);
 const sellerName=clean(raw.sellerName||raw.seller_name||raw.storeName||raw.store_name||raw.seller,100);
 const phone=phoneNumber(raw.phone||raw.whatsapp||raw.whatsappNumber||raw.whatsapp_number);
 const location=canonicalLocation(raw.governorate||raw.city_governorate,raw.district||raw.directorate);
 const governorate=location?.governorate||"";
 const district=location?.district||"";
 const currency=canonicalCurrency(raw.currency||"YER");
 const listingType=clean(raw.listingType||raw.listing_type||"sale",16);
 const condition=clean(raw.condition||"unknown",16);
 const priceText=clean(raw.price??"",80).replace(/,/g,"");
 const priceValue=Number(priceText);
 if(!title||!id||!sellerName||!phone||!governorate||!district||!priceText||
    !Number.isFinite(priceValue)||priceValue<0||(priceValue===0&&listingType!=="free"))return null;
 if(!PRODUCT_TYPES.has(productType)||!CURRENCIES.has(currency)||!LISTING_TYPES.has(listingType)||!CONDITIONS.has(condition))return null;
 if(listingType==="rent"&&!["land","property","apartment","house","car","motorcycle"].includes(productType))return null;
 const productGroup=Object.entries(PRODUCT_GROUPS).find(([,types])=>types.includes(productType))?.[0]||"";
 if(!PRODUCT_GROUPS_ALLOWED.has(productGroup))return null;
 const productUrl=validHttps(raw.productUrl||raw.product_url||raw.url||raw.website);
 return {
  id,title,productType,productGroup,listingType,condition,sellerName,phone,governorate,district,
  area:clean(raw.neighbourhood||raw.area||"",120),
  description:clean(raw.description||raw.summary||"",1800),
  price:priceValue.toString(),currency,
  website:productUrl,
  sourceName:clean(raw.sourceName||raw.source_name||sellerName,100)
 };
}

async function getJson(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store",redirect:"error",signal:controller.signal});
  if(!response.ok)throw new Error("HTTP "+response.status+" from "+new URL(url).hostname);
  const text=await response.text();
  if(text.length>5_000_000)throw new Error("Feed exceeds 5 MB");
  const payload=JSON.parse(text);
  const items=Array.isArray(payload)?payload:payload&&Array.isArray(payload.items)?payload.items:null;
  if(!items)throw new Error("Expected JSON array or { items: [] }");
  return items;
 }finally{clearTimeout(timer);}
}
async function syncConfiguredFeeds(){
 const configured=String(process.env.DALILNA_PRODUCT_FEED_URLS||"").split(/[\\r\\n,]+/).map(x=>x.trim()).filter(Boolean).slice(0,MAX_FEEDS);
 if(!configured.length){
  console.log(JSON.stringify({event:"marketplace.feed_sync.skipped",reason:"No merchant JSON feed URLs configured",requiredEnv:"DALILNA_PRODUCT_FEED_URLS"}));
  return {configured:0,received:0,accepted:0,skipped:0,snapshotComplete:false};
 }
 const token=String(process.env.DALILNA_PRODUCT_SYNC_TOKEN||"");
 if(token.length<32)throw new Error("DALILNA_PRODUCT_SYNC_TOKEN must contain at least 32 characters");
 const collected=[],sourceStats=[],failures=[];let rejected=0,oversized=false,totalReceived=0;
 for(const rawUrl of configured){
  const url=validatePublicFeedUrl(rawUrl);
  if(!url){failures.push("feed URL rejected: HTTPS public host without credentials or redirects is required");continue;}
  try{
   const rawItems=await getJson(url.href),idPrefix=sourceId(url.href),normalized=[];
   totalReceived+=rawItems.length;
   if(rawItems.length>MAX_ITEMS||totalReceived>MAX_ITEMS)oversized=true;
   for(const raw of rawItems.slice(0,MAX_ITEMS)){
    if(isInactiveFeedItem(raw))continue;
    const item=mapFeedItem(raw);
    if(!item){rejected++;continue;}
    normalized.push({...item,clientRef:"feed:"+idPrefix+":"+item.id});
   }
   collected.push(...normalized);
   sourceStats.push({host:url.hostname,received:rawItems.length,accepted:normalized.length});
  }catch(error){failures.push(url.hostname+": "+clean(error.message,160));}
 }
 const unique=new Map();
 for(const item of collected)unique.set(item.clientRef,item);
 const items=[...unique.values()].slice(0,MAX_ITEMS);
 const snapshotComplete=failures.length===0&&rejected===0&&!oversized&&items.length>0&&items.length===unique.size;
 if(!items.length){
  if(failures.length)throw new Error("No usable products were returned. "+failures.join("; "));
  return {configured:configured.length,received:totalReceived,accepted:0,skipped:rejected,sources:sourceStats,snapshotComplete:false,snapshotWarning:"Empty feed snapshot is not allowed to archive existing products."};
 }
 const activeClientRefs=items.map(item=>item.clientRef);
 let inserted=0,updated=0,skipped=rejected,archived=0;
 for(let offset=0;offset<items.length;offset+=MAX_BATCH){
  const batch=items.slice(offset,offset+MAX_BATCH);
  const isLast=offset+batch.length>=items.length;
  const completeSnapshotForBatch=isLast&&snapshotComplete;
  const payloadItems=batch.map(item=>({
   id:item.id,clientRef:item.clientRef,title:item.title,productType:item.productType,
   listingType:item.listingType,condition:item.condition,governorate:item.governorate,
   district:item.district,area:item.area,description:item.description,phone:item.phone,
   sellerName:item.sellerName,price:item.price,currency:item.currency,website:item.website
  }));
  const response=await fetch(BASE+"/api/marketplace/feed-sync",{
   method:"POST",redirect:"error",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"},
   body:JSON.stringify({
    sourceKey:"verified-merchant-feeds",
    sourceName:"Verified merchant product feeds",
    completeSnapshot:completeSnapshotForBatch,
    activeClientRefs:completeSnapshotForBatch?activeClientRefs:[],
    items:payloadItems
   })
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error("Marketplace API "+response.status+": "+clean(result.error||"feed sync failed",220));
  inserted+=Number(result.inserted||0);updated+=Number(result.updated||0);skipped+=Number(result.skipped||0);archived+=Number(result.archived||0);
  if(completeSnapshotForBatch&&(result.skipped||0)>0)throw new Error("The API skipped records in the final batch. Existing feed listings were not archived.");
 }
 const summary={configured:configured.length,received:totalReceived,accepted:items.length,inserted,updated,skipped,archived,sources:sourceStats,snapshotComplete};
 if(oversized)summary.snapshotWarning="Feed size exceeded the maximum supported snapshot; existing listings were not archived.";
 if(failures.length)summary.sourceWarnings=failures;
 console.log(JSON.stringify({event:"marketplace.feed_sync.completed",...summary}));
 return summary;
}
if(require.main===module)syncConfiguredFeeds().catch(error=>{console.error(JSON.stringify({event:"marketplace.feed_sync.failed",error:clean(error.message,300)}));process.exitCode=1;});
module.exports={syncConfiguredFeeds,mapFeedItem,phoneNumber,canonicalLocation,canonicalProductType,canonicalCurrency};
