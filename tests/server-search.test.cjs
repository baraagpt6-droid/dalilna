"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {inferCategoryFromQuery,buildOverpassQuery,classifyCategory,searchPlaces,overpassAttemptTimeout}=require("../server");


test("global fallback searches Nominatim then the Yemen-bounded Overpass mirror",async()=>{
 const originalFetch=global.fetch;
 const unique="dalilna-test-pharmacy-"+Date.now();
 const requested=[];
 global.fetch=async(input,options={})=>{
  const url=new URL(String(input));
  requested.push({url,options});
  if(url.hostname==="nominatim.openstreetmap.org"){
   return new Response(JSON.stringify([{
    place_id:99,osm_type:"node",osm_id:123,lat:"15.36",lon:"44.19",
    category:"amenity",type:"pharmacy",name:"صيدلية الاختبار",
    display_name:"صيدلية الاختبار، حبيش، إب، اليمن",
    address:{country_code:"ye",state:"إب",county:"حبيش"},
    extratags:{phone:"+967777123456",opening_hours:"08:00-22:00"},
    namedetails:{"name:en":"Test Pharmacy"}
   }]),{status:200,headers:{"content-type":"application/json"}});
  }
  assert.ok(["overpass-api.de","overpass.private.coffee","maps.mail.ru"].includes(url.hostname),url.hostname);
  assert.equal(options.method,"POST");
  const ql=new URLSearchParams(options.body).get("data");
  assert.ok(ql.includes('area["ISO3166-1"="YE"][admin_level=2]->.yemen'));
  assert.ok(ql.includes("(area.yemen)"));
  return new Response(JSON.stringify({elements:[]}),{status:200,headers:{"content-type":"application/json"}});
 };
 try{
  const result=await searchPlaces({q:unique,place:"اليمن",lat:0,lon:0,category:"pharmacy"});
  const nom=requested.find(item=>item.url.hostname==="nominatim.openstreetmap.org");
  assert.ok(nom);
  assert.equal(nom.url.searchParams.get("countrycodes"),"ye");
  assert.equal(nom.url.searchParams.get("q"),unique);
  assert.equal(nom.url.searchParams.has("lat"),false);
  assert.ok(requested.some(item=>item.url.hostname==="overpass-api.de"||item.url.hostname==="overpass.private.coffee"||item.url.hostname==="maps.mail.ru"));
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
 assert.match(source,/await geocodePhotonFallback\(candidates,key,deadlineAt\)/);
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
 assert.equal(classifyCategory({shop:"watches"}),"gold");
});

test("Yemen Nominatim and Overpass requests stay within one bounded three-second search deadline",()=>{
 const source=fs.readFileSync(require.resolve("../server"),"utf8");
 assert.ok(source.includes("timeoutMs:3000"));
 assert.ok(source.includes("const deadlineAt=Date.now()+2800"));
 assert.ok(source.includes("overpassAttemptTimeout(remaining,providerIndex,endpoints.length)"));
 assert.equal((source.match(/overpassAttemptTimeout\\(remaining,providerIndex,endpoints.length\\)/g)||[]).length,2);
 assert.ok(source.includes("Math.min(1250,remaining)"));
 assert.ok(source.includes("[out:json][timeout:3]"));
});
test("countrywide live search starts Nominatim and Overpass without serial waiting",()=>{
 const source=fs.readFileSync(require.resolve("../server"),"utf8");
 assert.ok(source.includes("const outcomes=await Promise.allSettled(["));
 assert.ok(source.includes("searchYemenNominatim(query,category,deadlineAt)"));
 assert.ok(source.includes("searchYemenOverpass(query,category,deadlineAt)"));
});

test("Overpass retry budgets preserve time for all three provider starts",()=>{
 assert.equal(overpassAttemptTimeout(2800,0,3),1100);
 assert.equal(overpassAttemptTimeout(1700,1,3),600);
 assert.equal(overpassAttemptTimeout(600,2,3),600);
 assert.equal(overpassAttemptTimeout(500,2,3),500);
 assert.equal(overpassAttemptTimeout(300,1,3),0);
});
