"use strict";
const crypto=require("node:crypto");
const {PRODUCT_TYPES,GOVERNORATES,PRODUCT_GROUPS}=require("../marketplace-api");

const MAX_FEEDS=20,MAX_ITEMS=200;
const CURRENCIES=new Set(["YER","SAR","USD","OMR","AED","other"]);
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
function sourceId(url){return crypto.createHash("sha256").update(url).digest("hex").slice(0,16);}
function isInactiveFeedItem(raw){
 const status=String(raw?.status||raw?.availability||"available").toLowerCase();
 return raw?.active===false||["sold","deleted","expired","inactive","unavailable","out_of_stock"].includes(status);
}
function mapFeedItem(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||isInactiveFeedItem(raw))return null;
 const title=clean(raw.title||raw.name||raw.product_name,120);
 const id=clean(raw.id||raw.sku||raw.product_id||raw.url,100);
 const productType=clean(raw.productType||raw.product_type||raw.type,32);
 const sellerName=clean(raw.sellerName||raw.seller_name||raw.storeName||raw.store_name||raw.seller,100);
 const phone=phoneNumber(raw.phone||raw.whatsapp||raw.whatsappNumber||raw.whatsapp_number);
 const governorate=clean(raw.governorate||raw.city_governorate,80);
 const district=clean(raw.district||raw.directorate,100);
 const currencyInput=clean(raw.currency||"YER",8).toUpperCase();
 const currency=currencyInput==="OTHER"?"other":currencyInput;
 const listingType=clean(raw.listingType||raw.listing_type||"sale",16);
 const condition=clean(raw.condition||"unknown",16);
 const priceText=clean(raw.price??"",80).replace(/,/g,"");
 const priceValue=Number(priceText);
 if(!title||!id||!sellerName||!phone||!GOVERNORATES.has(governorate)||!district||!priceText||
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
  const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store",signal:controller.signal});
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
 const configured=String(process.env.DALILNA_PRODUCT_FEED_URLS||"").split(/[\r\n,]+/).map(x=>x.trim()).filter(Boolean).slice(0,MAX_FEEDS);
 if(!configured.length){
  console.log(JSON.stringify({event:"marketplace.feed_sync.skipped",reason:"No merchant JSON feed URLs configured",requiredEnv:"DALILNA_PRODUCT_FEED_URLS"}));
  return {configured:0,received:0,accepted:0,skipped:0};
 }
 const token=String(process.env.DALILNA_PRODUCT_SYNC_TOKEN||"");
 if(token.length<32)throw new Error("DALILNA_PRODUCT_SYNC_TOKEN must contain at least 32 characters");
 const collected=[],sourceStats=[],failures=[];let rejected=0,oversized=false;
 for(const feedUrl of configured){
  let url;
  try{url=new URL(feedUrl);}catch(_){failures.push("invalid feed URL");continue;}
  if(url.protocol!=="https:"||url.username||url.password){failures.push("feed URL must use HTTPS");continue;}
  try{
   const rawItems=await getJson(url.href),idPrefix=sourceId(url.href),normalized=[];
   if(rawItems.length>MAX_ITEMS)oversized=true;
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
 const snapshotComplete=failures.length===0&&rejected===0&&!oversized&&collected.length<=MAX_ITEMS;
 if(!collected.length&&!snapshotComplete){
  if(failures.length)throw new Error("No usable products were returned. "+failures.join("; "));
  return {configured:configured.length,received:sourceStats.reduce((n,x)=>n+x.received,0),accepted:0,skipped:rejected,sources:sourceStats,snapshotComplete:false};
 }
 const unique=new Map();
 for(const item of collected)unique.set(item.clientRef,item);
 const items=[...unique.values()].slice(0,MAX_ITEMS).map(item=>({
  id:item.id,clientRef:item.clientRef,title:item.title,productType:item.productType,
  listingType:item.listingType,condition:item.condition,governorate:item.governorate,
  district:item.district,area:item.area,description:item.description,phone:item.phone,
  sellerName:item.sellerName,price:item.price,currency:item.currency,website:item.website,productGroup:item.productGroup
 }));
 const response=await fetch(BASE+"/api/marketplace/feed-sync",{
  method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"},
  body:JSON.stringify({sourceKey:"verified-merchant-feeds",sourceName:"Verified merchant product feeds",completeSnapshot:snapshotComplete,items})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error("Marketplace API "+response.status+": "+clean(result.error||"feed sync failed",220));
 const summary={configured:configured.length,received:sourceStats.reduce((n,x)=>n+x.received,0),accepted:items.length,skipped:collected.length-items.length,sources:sourceStats,api:result};
 summary.rejected=rejected;
 if(oversized)summary.snapshotWarning="At least one feed exceeded the supported maximum; stale listings were not archived.";
 if(failures.length)summary.sourceWarnings=failures;
 console.log(JSON.stringify({event:"marketplace.feed_sync.completed",...summary}));
 return summary;
}
if(require.main===module)syncConfiguredFeeds().catch(error=>{console.error(JSON.stringify({event:"marketplace.feed_sync.failed",error:clean(error.message,300)}));process.exitCode=1;});
module.exports={syncConfiguredFeeds,mapFeedItem,phoneNumber};
