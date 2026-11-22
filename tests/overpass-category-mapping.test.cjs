"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildOverpassQuery,inferCategoryFromQuery}=require("../server");

const box={south:13.1,west:42.5,north:15.2,east:45.1};
test("Overpass health filter includes all matching OSM health tags",()=>{
 const query=buildOverpassQuery(box,"health");
 for(const tag of ['["amenity"="hospital"]','["amenity"="clinic"]','["amenity"="doctors"]','["healthcare"="hospital"]','["healthcare"="clinic"]'])assert.ok(query.includes(tag),tag);
 assert.ok(!query.includes('["amenity"="pharmacy"]'),"pharmacies must not appear in hospitals and clinics");
 assert.ok(!query.includes('["healthcare"="pharmacy"]'),"pharmacies must not appear in hospitals and clinics");
 assert.ok(!query.includes(']="'));
});
test("Overpass delivery filter includes courier and parcel OSM tags",()=>{
 const query=buildOverpassQuery(box,"delivery");
 for(const tag of ['["office"="courier"]','["office"="delivery"]','["office"="logistics"]','["shop"="parcel"]','["service"="delivery"]','["delivery"]'])assert.ok(query.includes(tag),tag);
});
test("server search infers mapped Arabic and English categories",()=>{
 assert.equal(inferCategoryFromQuery("مستشفى"),"health");
 assert.equal(inferCategoryFromQuery("hospital"),"health");
 assert.equal(inferCategoryFromQuery("صيدلية"),"pharmacy");
 assert.equal(inferCategoryFromQuery("courier"),"delivery");
 assert.equal(inferCategoryFromQuery("توصيل طلبات"),"delivery");
 assert.equal(inferCategoryFromQuery("أراضٍ وعقارات"),"land");
});

test("Yemen-wide Overpass fallback is restricted to the Yemen country area",()=>{
 const query=require("../server").buildYemenOverpassQuery("صيدلية","pharmacy");
 assert.ok(query.includes('area["ISO3166-1"="YE"][admin_level=2]->.yemen'));
 assert.ok(query.includes('["amenity"="pharmacy"](area.yemen)'));
 assert.ok(!query.includes('["amenity"="hospital"](area.yemen)'));
});
test("Yemen-wide Overpass name fallback searches public place names",()=>{
 const query=require("../server").buildYemenOverpassQuery("صيدلية النور","all");
 assert.ok(query.includes('["name"~"صيدلية النور",i]'));
 assert.ok(query.includes('["name:ar"~"صيدلية النور",i]'));
 assert.ok(query.includes('area.yemen'));
});
