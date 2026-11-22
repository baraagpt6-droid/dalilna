"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {buildOverpassQuery,inferCategoryFromQuery,classifyCategory,normalizeElement,normalizeText,createIntervalGate,searchCommonsPhotos,searchGeoapifyPlaces,geoapifyEnabled,geoapifyRectFilter,server}=require("../server");

test("builds a narrow grocery query for a supplied bounding box",()=>{
 const query=buildOverpassQuery({south:13.1,west:43.2,north:13.4,east:43.5},"grocery");
 assert.match(query,/shop/);assert.match(query,/convenience/);assert.match(query,/supermarket/);
 assert.match(query,/13\.100000,43\.200000,13\.400000,43\.500000/);
 assert.match(query,/timeout:12/);assert.match(query,/out center tags 80/);
});
test("infers map categories from Arabic search terms",()=>{
 assert.equal(inferCategoryFromQuery("بقال"),"grocery");
 assert.equal(inferCategoryFromQuery("صيدلية"),"pharmacy");
 assert.equal(inferCategoryFromQuery("مطعم"),"food");
 assert.equal(inferCategoryFromQuery("اسم محل غير محدد"),"");
});
test("classifies common OpenStreetMap business tags",()=>{
 assert.equal(classifyCategory({shop:"convenience"}),"grocery");
 assert.equal(classifyCategory({amenity:"pharmacy"}),"pharmacy");
 assert.equal(classifyCategory({amenity:"restaurant"}),"food");
 assert.equal(classifyCategory({amenity:"school"}),"edu");
 assert.equal(classifyCategory({tourism:"hotel"}),"hotel");
});
test("normalizes OSM features and retains source identifiers",()=>{
 const item=normalizeElement({type:"node",id:123,lat:13.3,lon:43.1,tags:{name:"بقالة الاختبار",shop:"convenience",phone:"777123456",opening_hours:"08:00-22:00"}},"حبيش، إب، اليمن");
 assert.ok(item);assert.equal(item.id,"osm-node-123");assert.equal(item.category,"grocery");
 assert.equal(item.phone,"777123456");assert.equal(item.openingHours,"08:00-22:00");
 assert.match(item.sourceUrl,/openstreetmap\.org\/node\/123/);assert.match(item.mapsUrl,/openstreetmap\.org/);
});
test("normalizes extra OSM business details when available",()=>{
 const item=normalizeElement({type:"node",id:321,lat:13.3,lon:43.1,tags:{name:"مطعم تجريبي",amenity:"restaurant",cuisine:"yemeni",brand:"علامة محلية",operator:"المشغل",description:"وصف المكان",email:"contact@example.test",website:"https://example.test"}},"حبيش");
 assert.equal(item.cuisine,"yemeni");assert.equal(item.brand,"علامة محلية");assert.equal(item.operator,"المشغل");
 assert.equal(item.description,"وصف المكان");assert.equal(item.email,"contact@example.test");assert.equal(item.website,"https://example.test/");
});
test("ignores unnamed or unlocated map objects",()=>{
 assert.equal(normalizeElement({type:"way",id:9,center:{lat:13,lon:43},tags:{shop:"convenience"}},"إب"),null);
 assert.equal(normalizeElement({type:"node",id:10,tags:{name:"بقالة"}},"إب"),null);
});
test("normalizes Arabic spelling for live filtering",()=>assert.equal(normalizeText("أَبْرَاء"),"ابراء"));
test("Vercel Places route exports a Node handler and bounded duration",()=>{
 const handler=require("../api/places/search");assert.equal(typeof handler,"function");assert.equal(handler.config.maxDuration,60);
});
test("central request gate serializes concurrent callers",async()=>{
 const wait=createIntervalGate(35),started=[];await Promise.all(Array.from({length:3},async()=>{await wait();started.push(Date.now());}));
 started.sort((a,b)=>a-b);assert.ok(started[1]-started[0]>=25);assert.ok(started[2]-started[1]>=25);
});
test("Geoapify rectangle order follows longitude, latitude, longitude, latitude",()=>{
 assert.equal(geoapifyRectFilter({west:43,north:15.5,east:43.5,south:15}),"rect:43,15,43.5,15.5");
 assert.equal(geoapifyRectFilter({west:43.5,north:15,east:43,south:15.5}),"rect:43,15,43.5,15.5");
 assert.throws(()=>geoapifyRectFilter({west:43,east:43,north:15.5,south:15}),/Invalid geographic bounding box/);
});
test("Arabic search terms map to the intended category",()=>{
 assert.equal(inferCategoryFromQuery("مدرسه"),"edu");
 assert.equal(inferCategoryFromQuery("مستشفى"),"health");
 assert.equal(inferCategoryFromQuery("صيدلية"),"pharmacy");
 assert.equal(inferCategoryFromQuery("جوالات"),"telecom");
 assert.equal(inferCategoryFromQuery("لابتوب"),"elec");
 assert.equal(inferCategoryFromQuery("مطعم"),"food");
});
test("Geoapify free integration stays disabled without a server-side key",async()=>{
 const originalKey=process.env.GEOAPIFY_API_KEY;
 delete process.env.GEOAPIFY_API_KEY;
 try{
  assert.equal(geoapifyEnabled(),false);
  await assert.rejects(searchGeoapifyPlaces({q:"بقال",category:"grocery",lat:"15.36",lon:"44.19"}),error=>error.code==="GEOAPIFY_NOT_CONFIGURED"&&error.statusCode===503);
 }finally{
  if(originalKey===undefined)delete process.env.GEOAPIFY_API_KEY;else process.env.GEOAPIFY_API_KEY=originalKey;
 }
});
test("Geoapify returns in-app place cards and obtains phone from Place Details",async()=>{
 const originalKey=process.env.GEOAPIFY_API_KEY,originalFetch=global.fetch;
 process.env.GEOAPIFY_API_KEY="server-only-geoapify-test-key";
 global.fetch=async(input,options={})=>{
  const url=new URL(String(input));
  assert.equal(url.hostname,"api.geoapify.com");
  assert.equal(url.searchParams.get("apiKey"),"server-only-geoapify-test-key");
  if(url.pathname==="/v2/places"){
   assert.equal(url.searchParams.get("categories"),"commercial.supermarket,commercial.convenience,commercial.marketplace");
   assert.match(url.searchParams.get("filter"),/^rect:/);
   assert.equal(url.searchParams.get("lang"),"ar");
   return new Response(JSON.stringify({type:"FeatureCollection",features:[{
    type:"Feature",geometry:{type:"Point",coordinates:[44.19,15.36]},
    properties:{name:"بقالة الاختبار",place_id:"geoapify-test-place-161",formatted:"شارع الاختبار، صنعاء، اليمن",categories:["commercial.convenience"],lat:15.36,lon:44.19}
   }]}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(url.pathname==="/v2/place-details"){
   assert.equal(url.searchParams.get("id"),"geoapify-test-place-161");
   return new Response(JSON.stringify({type:"FeatureCollection",features:[{
    type:"Feature",geometry:{type:"Point",coordinates:[44.19,15.36]},
    properties:{feature_type:"details",name:"بقالة الاختبار",contact:{phone:"+967 777 111 222"},website:"https://example.test",opening_hours:"08:00-22:00"}
   }]}),{status:200,headers:{"content-type":"application/json"}});
  }
  throw new Error("Unexpected Geoapify endpoint "+url.pathname);
 };
 try{
  assert.equal(geoapifyEnabled(),true);
  const result=await searchGeoapifyPlaces({q:"بقال",category:"grocery",lat:"15.36",lon:"44.19",radius:"5000"});
  assert.equal(result.source,"Geoapify");
  assert.equal(result.count,1);
  assert.equal(result.items[0].name,"بقالة الاختبار");
  assert.equal(result.items[0].phone,"+967 777 111 222");
  assert.equal(result.items[0].website,"https://example.test");
  assert.equal(result.items[0].category,"بقالات وتموينات");
  assert.match(result.items[0].mapsUrl,/google\.com\/maps\/search/);
  assert.match(result.attribution,/OpenStreetMap/);
 }finally{
  global.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GEOAPIFY_API_KEY;else process.env.GEOAPIFY_API_KEY=originalKey;
 }
});
test("Wikimedia Commons search returns author and license metadata",async()=>{
 const original=global.fetch;
 global.fetch=async(input,options={})=>{
  const url=new URL(String(input));assert.equal(url.hostname,"commons.wikimedia.org");
  assert.ok(String(options.headers["User-Agent"]).includes("DalilnaDirectory/"+require("../package.json").version));
  return new Response(JSON.stringify({query:{pages:[{title:"File:Dalilna place.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/dalilna.jpg",descriptionurl:"https://commons.wikimedia.org/wiki/File:Dalilna_place.jpg",extmetadata:{LicenseShortName:{value:"CC BY-SA 4.0"},Artist:{value:"Photographer One"}}}]}]}}),{status:200,headers:{"content-type":"application/json"}});
 };
 try{const result=await searchCommonsPhotos("Dalilna Commons unique test","Yemen");assert.equal(result.source,"Wikimedia Commons");assert.equal(result.count,1);assert.equal(result.items[0].license,"CC BY-SA 4.0");assert.equal(result.items[0].author,"Photographer One");assert.match(result.items[0].sourceUrl,/commons\.wikimedia\.org/);}
 finally{global.fetch=original;}
});
test("Geoapify status endpoint is public and confirms free provider setup",async()=>{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 try{
  const base="http://127.0.0.1:"+server.address().port;
  const statusResponse=await fetch(base+"/api/places/status",{headers:{Origin:"https://preview.example"}});
  assert.equal(statusResponse.headers.get("access-control-allow-origin"),"*");
  const status=await statusResponse.json();
  assert.equal(status.activeProvider,"OpenStreetMap");assert.equal(status.paidProvidersDisabled,true);assert.equal(status.photoProvider,"Wikimedia Commons");
  const geoStatusResponse=await fetch(base+"/api/geoapify/status",{headers:{Origin:"https://preview.example"}});
  assert.equal(geoStatusResponse.headers.get("access-control-allow-origin"),"*");
  const geoStatus=await geoStatusResponse.json();
  assert.equal(geoStatus.provider,"Geoapify");
  assert.equal(geoStatus.geoapifyEnabled,false);
  assert.equal(geoStatus.creditCardRequired,false);
  assert.equal(JSON.stringify(geoStatus).includes("GEOAPIFY_API_KEY"),false);
  const healthResponse=await fetch(base+"/health");
  assert.equal(healthResponse.status,200);
  const health=await healthResponse.json();
  assert.equal(health.version,require("../package.json").version);
  const preflight=await fetch(base+"/api/places/search",{method:"OPTIONS",headers:{Origin:"https://preview.example","Access-Control-Request-Method":"GET"}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get("access-control-allow-origin"),"*");
  const details=await fetch(base+"/api/places/details?placeId=ChIJOldGooglePlaceId123");
  assert.equal(details.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
