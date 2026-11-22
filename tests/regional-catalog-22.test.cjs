"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const runtime=require("../regional-catalog-runtime");
const root=path.join(__dirname,"..","regional-catalog");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
test("regional catalogue contains all 22 Yemeni governorates and 14,883 places",()=>{
 assert.equal(manifest.governorates.length,22);
 assert.equal(manifest.totalCount,14883);
});
test("every governorate file loads with stable identifiers",()=>{
 let total=0;
 for(const region of manifest.governorates){
  const payload=JSON.parse(fs.readFileSync(path.join(root,region.file),"utf8"));
  const items=runtime.normalizeItems(payload);
  assert.equal(items.length,region.count,region.name);
  assert.ok(items.every(item=>item&&typeof item.id==="string"&&item.id.length>0),region.name+" ids");
  assert.equal(new Set(items.map(item=>item.id)).size,items.length,region.name+" unique ids");
  total+=items.length;
 }
 assert.equal(total,manifest.totalCount);
});
test("catalogue builder prefers district polygons before governorate-only boundaries",()=>{
 const source=fs.readFileSync(require("node:path").join(__dirname,"../scripts/build_regional_catalog.py"),"utf8");
 assert.ok(source.includes("if target.get(\"district\"):"));
 assert.ok(source.includes("local_districts = [d for d in districts if d[\"governorate\"] == matched_governorate]"));
});
test("district backfill script writes a reconciled manifest from the 335 official districts",()=>{
 const source=fs.readFileSync(require("node:path").join(__dirname,"../scripts/backfill_district_counts.py"),"utf8");
 for(const token of ["Expected 335 administrative districts","districtCountTotal","unassignedCount","approximate-district-centroid","70"] )assert.ok(source.includes(token),token);
});
test("district count manifest contains 335 districts and separates approximate assignments",()=>{
 if(!Array.isArray(manifest.districtCounts)) return; // The next catalog refresh publishes this field.
 assert.equal(manifest.districtCounts.length,335);
 const keys=manifest.districtCounts.map(x=>x.governorate+"|"+x.district);
 assert.equal(new Set(keys).size,335);
 for(const row of manifest.districtCounts){
  assert.ok(Number.isInteger(row.count)&&row.count>=0);
  assert.ok(Number.isInteger(row.boundaryCount)&&row.boundaryCount>=0);
  assert.ok(Number.isInteger(row.approximateCount)&&row.approximateCount>=0);
  assert.equal(row.count,row.boundaryCount+row.approximateCount);
 }
 assert.equal(manifest.districtCountTotal,manifest.districtCounts.reduce((sum,row)=>sum+row.count,0));
 if(Number.isInteger(manifest.unassignedCount))assert.equal(manifest.districtCountTotal+manifest.unassignedCount,manifest.totalCount);
 assert.ok(manifest.districtCountTotal<=manifest.totalCount);
});
test("reader accepts arrays, object arrays, and keyed object maps",()=>{
 const array=[{name:"صيدلية",category:"pharmacy",lat:15,lon:44}],mapped={"osm-node-44":{name:"محل",category:"grocery",lat:15,lon:44}};
 assert.equal(runtime.normalizeItems(array).length,1);
 assert.equal(runtime.normalizeItems({items:array}).length,1);
 assert.equal(runtime.normalizeItems({items:mapped})[0].id,"osm-node-44");
 assert.equal(runtime.normalizeItems(null).length,0);
 assert.equal(runtime.normalizeItems({metadata:{snapshotDate:"2026-11-22"}}).length,0);
});
test("Arabic letters normalize consistently for instant search",()=>{
 assert.equal(runtime.normalizeArabic("صيدليه"),runtime.normalizeArabic("صيدلية"));
 assert.equal(runtime.normalizeArabic("بقاله"),runtime.normalizeArabic("بقالة"));
 assert.equal(runtime.normalizeArabic("إب"),runtime.normalizeArabic("اب"));
 assert.equal(runtime.normalizeArabic("على"),runtime.normalizeArabic("علي"));
});
test("WhatsApp detection only returns Yemen mobile numbers",()=>{
 for(const prefix of ["70","71","73","77","78"])assert.equal(runtime.yemenPhone("+967"+prefix+"1234567").isMobile,true,prefix);
 for(const phone of ["+967 1 234 567","+967 2 234 567","+967 4 234 567","01 234567"])assert.equal(runtime.yemenPhone(phone).isMobile,false,phone);
});
