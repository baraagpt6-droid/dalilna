'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('regions-profiles.js','utf8'),context);
const profiles=context.window.DALILNA_REGION_PROFILES;
const counts=context.window.DALILNA_HERITAGE_COUNTS_2013;
const sources=context.window.DALILNA_REGION_SOURCES;
const html=fs.readFileSync('index.html','utf8');
test('22 governorates have profiles with population projections and landmarks',()=>{
 assert.equal(Object.keys(profiles).length,22);
 for(const p of Object.values(profiles)){
  assert.ok(p.summary.length>20);
  assert.ok(p.nature.length>10);
  assert.ok(p.landmarks.length>=3);
  assert.ok(Number.isInteger(p.population2023)&&p.population2023>0);
 }
});
test('2023 projections total 32.618 million',()=>{
 assert.equal(Object.values(profiles).reduce((sum,p)=>sum+p.population2023,0),32618000);
});
test('2013 heritage inventory counts include all governorates',()=>{
 assert.equal(Object.keys(counts).length,22);
 for(const name of Object.keys(profiles))assert.ok(Number.isInteger(counts[name]));
});
test('population, heritage, geography, administrative and district methodology sources exist',()=>{
 for(const key of ['administrative','population','populationBook','heritageInventory','unescoYemen','unescoTentative','geography','districtPopulation'])assert.match(sources[key],/^https:\/\//);
});
test('regional profiles link to locally indexed service categories instead of Google Maps searches',()=>{
 for(const token of ['regionProfileDetails','غير متاح','data-region-category=','المساجد والجوامع','المدارس والمعاهد','المستشفيات والمراكز الصحية','WorldPop 2024','تصفح المحلات والخدمات في هذه المنطقة'])assert.ok(html.includes(token),token);
 assert.doesNotMatch(html,/google\\.com\\/maps\\/search/);
});
test('photos and likes are local and image data is sanitized',()=>{
 for(const token of ['regionPosts:[]','regionLikes:{}','safeImageData(p.img)','regionImageInput','regionLikeButton','على هذا الجهاز'])assert.ok(html.includes(token),token);
});
