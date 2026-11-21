"use strict";
const assert=require("node:assert/strict");
const base=String(process.env.LIVE_API_BASE_URL||"https://dalilna-live.onrender.com").replace(/\/+$/,"");
async function get(path,extraHeaders={}){
 const response=await fetch(base+path,{headers:{Accept:"application/json",...extraHeaders},cache:"no-store",signal:AbortSignal.timeout(90000)});
 const payload=await response.json().catch(()=>({}));return {response,payload};
}
async function main(){
 const deadline=Date.now()+180000;let health=null,last="no response";
 while(Date.now()<deadline){
  try{const r=await get("/health");if(r.response.ok&&r.payload.ok&&r.payload.version==="1.6.1"){health=r.payload;break;}last="unexpected health: "+JSON.stringify(r.payload);}
  catch(e){last=e.message;}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 assert.ok(health,"Render service did not become healthy on v1.6.1: "+last);
 process.stdout.write("PASS live Render health: "+health.version+"\n");
 let r=await get("/api/places/status",{Origin:"https://dalilna-yemen.onrender.com"});assert.equal(r.response.status,200);
 assert.equal(r.response.headers.get("access-control-allow-origin"),"*");
 assert.equal(r.payload.activeProvider,"OpenStreetMap");assert.equal(r.payload.paidProvidersDisabled,true);assert.equal(r.payload.photoProvider,"Wikimedia Commons");
 process.stdout.write("PASS browser CORS for public map API\\n");
 process.stdout.write("PASS live open-data provider status\n");
 const geo=await get("/api/geoapify/status",{Origin:"https://dalilna-yemen.onrender.com"});
 assert.equal(geo.response.status,200);
 assert.equal(typeof geo.payload.geoapifyEnabled,"boolean");
 assert.equal(geo.payload.creditCardRequired,false);
 assert.equal(JSON.stringify(geo.payload).includes("GEOAPIFY_API_KEY"),false);
 process.stdout.write("PASS free Geoapify status endpoint does not expose the server key\\n");
 const query=new URLSearchParams({q:"مطعم",category:"food",lat:"15.3694",lon:"44.1910",radius:"7000"});
 r=await get("/api/places/search?"+query);assert.equal(r.response.status,200);assert.equal(r.payload.source,"OpenStreetMap");assert.ok(Array.isArray(r.payload.items));
 process.stdout.write("PASS live OSM search returned "+r.payload.count+" results\n");
 r=await get("/api/places/photos?q=Sanaa%20mosque&place=Sanaa%20Yemen");assert.equal(r.response.status,200);assert.equal(r.payload.source,"Wikimedia Commons");assert.ok(Array.isArray(r.payload.items));
 process.stdout.write("PASS live Commons photo endpoint returned "+r.payload.count+" results\n");
 process.stdout.write("RESULT: live free-source smoke tests passed\n");
}
main().catch(error=>{process.stderr.write((error&&error.stack)||String(error));process.exitCode=1;});
