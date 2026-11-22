"use strict";
const {syncConfiguredFeeds}=require("./refresh-marketplace-products.cjs");

const API=String(process.env.DALILNA_API_BASE_URL||"https://dalilna-live.onrender.com").replace(/\/+$/,"");
const FX="https://ye-rial.com/api/v1/current/";

async function readJson(url,timeoutMs=18000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store",signal:controller.signal});
  if(!response.ok)throw new Error("HTTP "+response.status+" from "+new URL(url).hostname);
  return await response.json();
 }finally{clearTimeout(timer);}
}
function parseTime(value){
 const text=String(value||"").trim();if(!text)return NaN;
 const normalized=text.includes("T")?text:text.replace(" ","T");
 const zoned=/Z$|[+-]\d\d:\d\d$/.test(normalized)?normalized:normalized+"+03:00";
 return Date.parse(zoned);
}
async function checkExchange(){
 const payload=await readJson(FX);
 if(payload.status!=="success")throw new Error("Yemen exchange-rate API returned an invalid status.");
 const verified=payload.last_verified_at||payload.last_sync;
 const at=parseTime(verified),age=Date.now()-at;
 const fresh=Number.isFinite(at)&&age>=-300000&&age<=86400000;
 const hasQuotes=["sanaa","aden"].every(market=>["usd","sar","gold_gram_21"].every(key=>{
  const row=payload.data?.[market]?.items?.[key];
  return row&&Number(row.buy)>0&&Number(row.sell)>0;
 }));
 console.log(JSON.stringify({event:"daily_sync.exchange",fresh:fresh&&hasQuotes,lastVerified:verified||null,ageHours:Number.isFinite(age)?Math.round(age/360000)/10:null,displayPolicy:"client hides stale rates"}));
 return {fresh:fresh&&hasQuotes,lastVerified:verified||null};
}
async function checkServices(){
 const [market,jobs]=await Promise.all([
  readJson(API+"/api/marketplace/status",60000),
  readJson(API+"/api/jobs?country=YE&limit=1",60000)
 ]);
 if(market.ready!==true)throw new Error("Shared marketplace database is not ready.");
 if(jobs.ok!==true||!Array.isArray(jobs.items))throw new Error("Jobs feed endpoint returned an invalid response.");
 console.log(JSON.stringify({event:"daily_sync.services",marketplaceReady:market.ready,jobsReturned:jobs.count||0,jobsFetchedAt:jobs.fetchedAt||null,jobsSources:Array.isArray(jobs.sources)?jobs.sources.length:0}));
 return {marketplaceReady:market.ready,jobsReturned:jobs.count||0};
}
async function main(){
 const startedAt=new Date().toISOString();
 const [services,exchange,products]=await Promise.all([checkServices(),checkExchange(),syncConfiguredFeeds()]);
 console.log(JSON.stringify({event:"daily_sync.completed",startedAt,completedAt:new Date().toISOString(),services,exchange,products}));
}
if(require.main===module)main().catch(error=>{console.error(JSON.stringify({event:"daily_sync.failed",message:String(error.message||error).slice(0,320)}));process.exitCode=1;});
module.exports={checkExchange,checkServices,parseTime};
