"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {inferCategoryFromQuery,buildOverpassQuery,classifyCategory}=require("../server");

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
