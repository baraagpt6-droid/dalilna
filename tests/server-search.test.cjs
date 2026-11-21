"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {inferCategoryFromQuery,buildOverpassQuery,classifyCategory}=require("../server");

test("understands exact stationery and school-supply searches",()=>{
 for(const q of ["قلم","دفتر","قرطاسية","مكتبة","أدوات مدرسية"])assert.equal(inferCategoryFromQuery(q),"books",q);
});

test("understands watches and vehicle searches",()=>{
 assert.equal(inferCategoryFromQuery("ساعات"),"watches");
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
