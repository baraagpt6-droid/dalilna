'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('regions-profiles.js','utf8'),context);
const profiles=context.window.DALILNA_REGION_PROFILES,counts=context.window.DALILNA_HERITAGE_COUNTS_2013,sources=context.window.DALILNA_REGION_SOURCES,html=fs.readFileSync('index.html','utf8');
test('22 governorates have population profiles and landmarks',()=>{
 assert.equal(Object.keys(profiles).length,22);
 for(const row of Object.values(profiles)){assert.ok(row.summary.length>20);assert.ok(row.nature.length>10);assert.ok(row.landmarks.length>=3);assert.ok(Number.isInteger(row.population2023)&&row.population2023>0);}
});
test('population projections total 32.618 million',()=>assert.equal(Object.values(profiles).reduce((sum,row)=>sum+row.population2023,0),32618000));
test('heritage inventory counts cover every governorate',()=>{assert.equal(Object.keys(counts).length,22);for(const name of Object.keys(profiles))assert.ok(Number.isInteger(counts[name]));});
test('profile source references are secure HTTPS URLs',()=>{for(const key of ['administrative','population','populationBook','heritageInventory','unescoYemen','unescoTentative','geography','districtPopulation'])assert.ok(String(sources[key]).startsWith('https://'),key);});
test('regional profiles open local categories, not Google Maps place searches',()=>{
 for(const token of ['regionProfileDetails','غير متاح','data-region-category=','المساجد والجوامع','المدارس والمعاهد','المستشفيات والمراكز الصحية','WorldPop 2024','تصفح المحلات والخدمات في هذه المنطقة'])assert.ok(html.includes(token),token);
 assert.ok(!html.includes('google.com/maps/search'));
});
test('community photos and likes remain local and sanitized',()=>{for(const token of ['regionPosts:[]','regionLikes:{}','safeImageData(p.img)','regionImageInput','regionLikeButton','على هذا الجهاز'])assert.ok(html.includes(token),token);});
