"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const FILE=path.join(ROOT,"market_prices_yemen.json");
const SOURCES=[
 {id:"samsung-galaxy-a08",url:"https://aramobi.com/mobile-prices-in-ye/",terms:["Samsung Galaxy A08 4G"]},
 {id:"xiaomi-redmi-note-15",url:"https://aramobi.com/mobile-prices-in-ye/",terms:["Xiaomi Redmi Note 15 4G"]},
  {id:"solar-panel-550w",url:"https://yemenfiy.com/shop/electronics/monocrystalline-solar-panel-550w/",terms:["لوح طاقة شمسية مونو كريستال 550W"]},
 {id:"hybrid-inverter-55kw",url:"https://yemenfiy.com/shop/electronics/hybrid-solar-inverter-5500w-mppt/",terms:["إنفرتر طاقة شمسية هجين 5.5KW"]},
 {id:"lithium-battery-48v-100ah",url:"https://yemenfiy.com/shop/electronics/lithium-solar-battery-48v-100ah/",terms:["بطارية طاقة شمسية ليثيوم 48V 100Ah"]}
];
function stripHtml(value){
 return String(value||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&")
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
  .replace(/\s+/g," ").trim();
}
function parseMoneyNear(text,terms){
 const normalized=String(text||"");
 let at=-1;
 for(const term of terms||[]){at=normalized.toLowerCase().indexOf(term.toLowerCase());if(at>=0)break;}
 if(at<0)return null;
 const fragment=normalized.slice(at,Math.min(normalized.length,at+1800));
 const matches=[...fragment.matchAll(/(?:([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})\s*(?:﷼|ريال(?:\s*يمني)?))/g)];
 if(matches.length){
  const n=Number(matches[0][1].replace(/,/g,""));
  return Number.isSafeInteger(n)&&n>0?n:null;
 }
 return null;
}
function parseProductMoney(text){
 const matches=[...String(text||"").matchAll(/(?:^|\s)([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})\s*(?:﷼|ريال(?:\s*يمني)?)(?:\s|$)/g)];
 for(const m of matches){const n=Number(m[1].replace(/,/g,""));if(Number.isSafeInteger(n)&&n>0)return n;}
 return null;
}
async function fetchText(url){
 const parsed=new URL(url);
 if(parsed.protocol!=="https:"||!["aramobi.com","yemenfiy.com"].includes(parsed.hostname))throw new Error("Source host is not allowlisted");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url,{headers:{Accept:"text/html","User-Agent":"DalilnaPriceGuide/2.9 (+https://baraagpt6-droid.github.io/dalilna/)"},redirect:"follow",signal:controller.signal,cache:"no-store"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const finalUrl=new URL(response.url||url);
  if(finalUrl.protocol!=="https:"||!["aramobi.com","yemenfiy.com"].includes(finalUrl.hostname))throw new Error("Source redirected outside the allowlist");
  const raw=await response.text();
  if(raw.length>3_000_000)throw new Error("Source page exceeds 3 MB");
  return stripHtml(raw);
 }finally{clearTimeout(timer);}
}
async function refresh(){
 const data=JSON.parse(fs.readFileSync(FILE,"utf8"));
 const today=new Date().toISOString().slice(0,10);
 const byId=new Map(data.items.map(item=>[item.id,item]));
 const pages=new Map(),updated=[],skipped=[];
 for(const source of SOURCES){
  try{
   let text=pages.get(source.url);
   if(!text){text=await fetchText(source.url);pages.set(source.url,text);}
   const item=byId.get(source.id);
   if(!item)continue;
   const amount=source.terms?parseMoneyNear(text,source.terms):parseProductMoney(text);
   if(!amount){skipped.push({id:source.id,reason:"No valid local YER price found"});continue;}
   if(item.pricing.currency!=="YER"){skipped.push({id:source.id,reason:"Unexpected currency; manual review required"});continue;}
   item.pricing.amount=amount;
   item.sourceCheckedAt=today;
   item.refreshStatus="updated";
   updated.push({id:source.id,amount});
  }catch(error){skipped.push({id:source.id,reason:String(error.message||error).slice(0,180)});}
 }
 if(updated.length){
  data.generatedAt=new Date().toISOString();
  data.lastChecked=today;
  data.lastRefresh={at:new Date().toISOString(),updated:updated.length,sourceCount:SOURCES.length};
  fs.writeFileSync(FILE,JSON.stringify(data,null,2)+"\n");
 }
 const summary={event:"market_prices.refresh",date:today,updated:updated.length,skipped:skipped.length,items:updated,skippedSources:skipped};
 console.log(JSON.stringify(summary));
 return summary;
}
if(require.main===module)refresh().catch(error=>{console.error(JSON.stringify({event:"market_prices.refresh_failed",error:String(error.message||error)}));process.exitCode=1;});
module.exports={stripHtml,parseMoneyNear,parseProductMoney,refresh};
