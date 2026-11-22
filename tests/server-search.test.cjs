"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {inferCategoryFromQuery,buildOverpassQuery,classifyCategory,searchPlaces}=require("../server");


test("global fallback searches Nominatim by query with countrycodes=ye",async()=>{
 const originalFetch=global.fetch;
 const unique="dalilna-test-pharmacy-"+Date.now();
 let requestedUrl;
 global.fetch=async input=>{
  requestedUrl=new URL(String(input));
  return new Response(JSON.stringify([{
   place_id:99,osm_type:"node",osm_id:123,lat:"15.36",lon:"44.19",
   category:"amenity",type:"pharmacy",name:"صيدلية الاختبار",
   display_name:"صيدلية الاختبار، حبيش، إب، اليمن",
   address:{country_code:"ye",state:"إب",county:"حبيش"},
   extratags:{phone:"+967777123456",opening_hours:"08:00-22:00"},
   namedetails:{"name:en":"Test Pharmacy"}
  }]),{status:200,headers:{"content-type":"application/json"}});
 };
 try{
  const result=await searchPlaces({q:unique,place:"اليمن",category:"pharmacy"});
  assert.ok(requestedUrl);
  assert.equal(requestedUrl.hostname,"nominatim.openstreetmap.org");
  assert.equal(requestedUrl.searchParams.get("countrycodes"),"ye");
  assert.equal(requestedUrl.searchParams.get("q"),unique);
  assert.equal(result.count,1);
  assert.equal(result.items[0].category,"pharmacy");
  assert.equal(result.items[0].phone,"+967777123456");
  assert.equal(result.items[0].district,"حبيش");
  assert.equal(result.items[0].governorate,"إب");
  assert.equal(result.items[0].lat,15.36);
  assert.match(result.items[0].mapsUrl,/openstreetmap.org/);
 }finally{global.fetch=originalFetch;}
});

test("geocoding falls back to Photon when Nominatim cannot provide a valid boundary",()=>{
 const source=fs.readFileSync(require.resolve("../server"),"utf8");
 assert.match(source,/async function geocodePhotonFallback\(/);
 assert.match(source,/await geocodePhotonFallback\(candidates,key\)/);
 assert.match(source,/properties\.extent/);
 assert.match(source,/countrycode/);
});
test("understands exact stationery and school-supply searches",()=>{
 for(const q of ["قلم","دفتر","قرطاسية","مكتبة","أدوات مدرسية"])assert.equal(inferCategoryFromQuery(q),"books",q);
});

test("understands watches and vehicle searches",()=>{
 assert.equal(inferCategoryFromQuery("ساعات"),"gold");
 assert.equal(inferCategoryFromQuery("معرض سيارات"),"vehicles");
 assert.equal(inferCategoryFromQuery("قطع غيار سيارات"),"vehicles");
});

test("OpenStreetMap stationery search includes real bookstore and stationery tags",()=>{
 const query=buildOverpassQuery({south:13,west:43,north:14,east:44},"books");
 assert.match(query,/stationery/);
 assert.match(query,/books/);
});

test("classifies named stationery and vehicle places",()=>{
 assert.equal(classifyCategory({shop:"stationery"}),"books");
 assert.equal(classifyCategory({shop:"car"}),"vehicles");
 assert.equal(classifyCategory({shop:"watches"}),"watches");
});
