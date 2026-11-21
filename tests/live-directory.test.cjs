"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {buildOverpassQuery,inferCategoryFromQuery,classifyCategory,normalizeElement,normalizeText,createIntervalGate,searchCommonsPhotos,searchGooglePlaces,googlePlacesEnabled,server}=require("../server");

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
test("Google Places is disabled without a server-side key",async()=>{
 const originalKey=process.env.GOOGLE_MAPS_API_KEY;
 delete process.env.GOOGLE_MAPS_API_KEY;
 try{
  assert.equal(googlePlacesEnabled(),false);
  await assert.rejects(searchGooglePlaces({q:"بقالة",place:"صنعاء، اليمن"}),error=>error.code==="GOOGLE_PLACES_NOT_CONFIGURED"&&error.statusCode===503);
 }finally{
  if(originalKey===undefined)delete process.env.GOOGLE_MAPS_API_KEY;else process.env.GOOGLE_MAPS_API_KEY=originalKey;
 }
});
test("Google Places search requests phone, category and Maps link fields and maps results",async()=>{
 const originalKey=process.env.GOOGLE_MAPS_API_KEY,originalFetch=global.fetch;
 process.env.GOOGLE_MAPS_API_KEY="server-only-test-key";
 global.fetch=async(input,options={})=>{
  assert.equal(String(input),"https://places.googleapis.com/v1/places:searchText");
  assert.equal(options.method,"POST");
  assert.equal(options.headers["X-Goog-Api-Key"],"server-only-test-key");
  assert.match(options.headers["X-Goog-FieldMask"],/places.nationalPhoneNumber/);
  assert.match(options.headers["X-Goog-FieldMask"],/places.googleMapsUri/);
  const body=JSON.parse(options.body);
  assert.equal(body.textQuery,"بقالة في صنعاء، اليمن");
  assert.equal(body.languageCode,"ar");
  assert.equal(body.regionCode,"YE");
  return new Response(JSON.stringify({places:[{
   id:"ChIJDalilnaTest",
   displayName:{text:"بقالة الاختبار"},
   formattedAddress:"صنعاء، اليمن",
   primaryType:"grocery_store",
   primaryTypeDisplayName:{text:"متجر بقالة"},
   nationalPhoneNumber:"+967 777 000 111",
   googleMapsUri:"https://maps.google.com/?cid=123456"
  }]}),{status:200,headers:{"content-type":"application/json"}});
 };
 try{
  assert.equal(googlePlacesEnabled(),true);
  const result=await searchGooglePlaces({q:"بقالة",place:"صنعاء، اليمن"});
  assert.equal(result.source,"Google Maps");
  assert.equal(result.count,1);
  assert.equal(result.items[0].name,"بقالة الاختبار");
  assert.equal(result.items[0].category,"متجر بقالة");
  assert.equal(result.items[0].phone,"+967 777 000 111");
  assert.equal(result.items[0].mapsUrl,"https://maps.google.com/?cid=123456");
  assert.equal(result.cached,false);
 }finally{
  global.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GOOGLE_MAPS_API_KEY;else process.env.GOOGLE_MAPS_API_KEY=originalKey;
 }
});

test("Wikimedia Commons search returns author and license metadata",async()=>{
 const original=global.fetch;
 global.fetch=async(input,options={})=>{
  const url=new URL(String(input));assert.equal(url.hostname,"commons.wikimedia.org");
  assert.match(options.headers["User-Agent"],/DalilnaDirectory\/1\.5\.10/);
  return new Response(JSON.stringify({query:{pages:[{title:"File:Dalilna place.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/dalilna.jpg",descriptionurl:"https://commons.wikimedia.org/wiki/File:Dalilna_place.jpg",extmetadata:{LicenseShortName:{value:"CC BY-SA 4.0"},Artist:{value:"Photographer One"}}}]}]}}),{status:200,headers:{"content-type":"application/json"}});
 };
 try{const result=await searchCommonsPhotos("Dalilna Commons unique test","Yemen");assert.equal(result.source,"Wikimedia Commons");assert.equal(result.count,1);assert.equal(result.items[0].license,"CC BY-SA 4.0");assert.equal(result.items[0].author,"Photographer One");assert.match(result.items[0].sourceUrl,/commons\.wikimedia\.org/);}
 finally{global.fetch=original;}
});
test("Google details endpoint is unavailable and status confirms free providers",async()=>{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 try{
  const base="http://127.0.0.1:"+server.address().port;
  const statusResponse=await fetch(base+"/api/places/status",{headers:{Origin:"https://preview.example"}});
  assert.equal(statusResponse.headers.get("access-control-allow-origin"),"*");
  const status=await statusResponse.json();
  assert.equal(status.activeProvider,"OpenStreetMap");assert.equal(status.paidProvidersDisabled,true);assert.equal(status.photoProvider,"Wikimedia Commons");
  const googleStatusResponse=await fetch(base+"/api/google/places/status",{headers:{Origin:"https://preview.example"}});
  assert.equal(googleStatusResponse.headers.get("access-control-allow-origin"),"*");
  const googleStatus=await googleStatusResponse.json();
  assert.equal(googleStatus.provider,"Google Maps");
  assert.equal(googleStatus.googlePlacesEnabled,false);
  assert.equal(JSON.stringify(googleStatus).includes("GOOGLE_MAPS_API_KEY"),false);
  const preflight=await fetch(base+"/api/places/search",{method:"OPTIONS",headers:{Origin:"https://preview.example","Access-Control-Request-Method":"GET"}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get("access-control-allow-origin"),"*");
  const details=await fetch(base+"/api/places/details?placeId=ChIJOldGooglePlaceId123");
  assert.equal(details.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
