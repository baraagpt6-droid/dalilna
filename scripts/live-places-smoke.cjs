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
  try{const r=await get("/health");if(r.response.ok&&r.payload.ok&&r.payload.version==="2.1.0"){health=r.payload;break;}last="unexpected health: "+JSON.stringify(r.payload);}
  catch(e){last=e.message;}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 assert.ok(health,"Render service did not become healthy on v2.1.0: "+last);
 process.stdout.write("PASS live Render health: "+health.version+"\n");
 let r=await get("/api/places/status",{Origin:"https://dalilna-yemen.onrender.com"});assert.equal(r.response.status,200);
 assert.equal(r.response.headers.get("access-control-allow-origin"),"*");
 assert.equal(r.payload.paidProvidersDisabled,true);assert.equal(r.payload.photoProvider,"Wikimedia Commons");
 process.stdout.write("PASS browser CORS for public map API\\n");
 process.stdout.write("PASS live open-data provider status\n");
 const geo=await get("/api/geoapify/status",{Origin:"https://dalilna-yemen.onrender.com"});
 assert.equal(geo.response.status,200);
 assert.equal(typeof geo.payload.geoapifyEnabled,"boolean");
 assert.equal(geo.payload.creditCardRequired,false);
 assert.equal(JSON.stringify(geo.payload).includes("GEOAPIFY_API_KEY"),false);
 assert.equal(r.payload.activeProvider,geo.payload.geoapifyEnabled?"Geoapify":"OpenStreetMap");
 process.stdout.write("PASS free Geoapify status endpoint does not expose the server key\\n");
 const geoQuery=new URLSearchParams({q:"بقالة",category:"grocery",lat:"15.3694",lon:"44.1910",radius:"7000"});
 r=await get("/api/geoapify/search?"+geoQuery);
 assert.equal(r.response.status,200);
 assert.equal(r.payload.source,"Geoapify");
 assert.ok(Array.isArray(r.payload.items));
 assert.ok(Number.isFinite(r.payload.count));
 process.stdout.write("PASS live Geoapify grocery search returned "+r.payload.count+" results\n");
 const commons=await get("/api/places/photos?q=Sanaa%20mosque&place=Sanaa%20Yemen");assert.equal(commons.response.status,200);assert.equal(commons.payload.source,"Wikimedia Commons");assert.ok(Array.isArray(commons.payload.items));
 const marketplace=await get("/api/marketplace/status");
 assert.equal(marketplace.response.status,200);
 assert.equal(marketplace.payload.ready,true,"shared PostgreSQL must be reachable and migrated");
 assert.equal(marketplace.payload.databaseConfigured,true);
 process.stdout.write("PASS shared Neon PostgreSQL status and schema\n");
 const listings=await get("/api/marketplace/listings?limit=5");
 assert.equal(listings.response.status,200);
 assert.ok(Array.isArray(listings.payload.items));
 process.stdout.write("PASS shared listings endpoint returned "+listings.payload.count+" approved listings\n");
 const schoolQuery=new URLSearchParams({q:"قلم",category:"books",lat:"15.3694",lon:"44.1910",radius:"7000"});
 const geoSchool=await get("/api/geoapify/search?"+schoolQuery);
 assert.equal(geoSchool.response.status,200);
 assert.equal(geoSchool.payload.source,"Geoapify");
 assert.ok(Array.isArray(geoSchool.payload.items));
 process.stdout.write("PASS live Geoapify stationery search returned "+geoSchool.payload.count+" results\n");
  const osmSchool=await get("/api/places/search?"+schoolQuery);
  if(osmSchool.response.status===200){
   assert.equal(osmSchool.payload.source,"OpenStreetMap");
   assert.ok(Array.isArray(osmSchool.payload.items));
   process.stdout.write("PASS live OpenStreetMap stationery fallback returned "+osmSchool.payload.count+" results\n");
  }else{
   assert.ok([502,503,504].includes(osmSchool.response.status),"Unexpected OpenStreetMap failure: "+osmSchool.response.status);
   process.stdout.write("WARN OpenStreetMap fallback temporarily unavailable (HTTP "+osmSchool.response.status+"); Geoapify returned "+geoSchool.payload.count+" stationery results.\n");
  }
  const capitalQuery=new URLSearchParams({q:"قلم",category:"books",place:"محافظة أمانة العاصمة، اليمن"});
  const capitalSearch=await get("/api/geoapify/search?"+capitalQuery);
  assert.equal(capitalSearch.response.status,200,"Amanat Al Asimah geocoding / Geoapify search must work");
  assert.equal(capitalSearch.payload.source,"Geoapify");
  assert.ok(Array.isArray(capitalSearch.payload.items));
  process.stdout.write("PASS governorate-name search for Amanat Al Asimah returned "+capitalSearch.payload.count+" results\n");

 process.stdout.write("PASS live Commons photo endpoint returned "+r.payload.count+" results\n");
 process.stdout.write("RESULT: live free-source smoke tests passed\n");
}
main().catch(error=>{process.stderr.write((error&&error.stack)||String(error));process.exitCode=1;});
