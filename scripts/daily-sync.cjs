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
 if(!fresh||!hasQuotes)throw new Error("Exchange feed is stale or lacks current USD, SAR and 21K gold buy/sell quotes.");
 return {fresh:true,lastVerified:verified||null};
}
async function checkServices(){
 const checks=await Promise.allSettled([
  readJson(API+"/api/marketplace/status",60000),
  readJson(API+"/api/jobs?country=YE&limit=1",60000)
 ]);
 const issues=[];
 const market=checks[0].status==="fulfilled"?checks[0].value:null;
 const jobs=checks[1].status==="fulfilled"?checks[1].value:null;
 if(!market)issues.push("Marketplace status: "+String(checks[0].reason?.message||checks[0].reason||"unavailable"));
 else if(market.ready!==true)issues.push("Shared marketplace database is not ready.");
 if(!jobs)issues.push("Jobs feed: "+String(checks[1].reason?.message||checks[1].reason||"unavailable"));
 else if(jobs.ok!==true||!Array.isArray(jobs.items))issues.push("Jobs feed endpoint returned an invalid response.");
 console.log(JSON.stringify({event:"daily_sync.services",marketplaceReady:market?.ready===true,jobsReturned:jobs?.count||0,jobsFetchedAt:jobs?.fetchedAt||null,jobsSources:Array.isArray(jobs?.sources)?jobs.sources.length:0,issues}));
 if(issues.length)throw new Error(issues.join(" "));
 return {marketplaceReady:true,jobsReturned:jobs.count||0};
}
async function main(){
 const startedAt=new Date().toISOString();
 const tasks=[
  ["services",checkServices],
  ["exchange",checkExchange],
  ["products",syncConfiguredFeeds]
 ];
 const results=await Promise.allSettled(tasks.map(([,task])=>task()));
 const summary={event:"daily_sync.completed",startedAt,completedAt:new Date().toISOString(),results:{}};
 const failures=[];
 results.forEach((result,index)=>{
  const key=tasks[index][0];
  if(result.status==="fulfilled")summary.results[key]=result.value;
  else{
   const message=String(result.reason?.message||result.reason||"unknown failure").slice(0,320);
   summary.results[key]={ok:false,error:message};
   failures.push(key+": "+message);
  }
 });
 console.log(JSON.stringify(summary));
 if(failures.length)throw new Error("Daily sync had failures: "+failures.join(" | "));
}

if(require.main===module)main().catch(error=>{console.error(JSON.stringify({event:"daily_sync.failed",message:String(error.message||error).slice(0,320)}));process.exitCode=1;});
module.exports={checkExchange,checkServices,parseTime};
