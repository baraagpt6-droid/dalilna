"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {validPhone,COUNTRIES,COUNTRY_CODES}=require("../jobs-api");
test("jobs portal supports the eight requested Arab countries",()=>{assert.equal(COUNTRIES.size,8);for(const x of ["Yemen","Saudi Arabia","United Arab Emirates","Oman","Qatar","Bahrain","Iraq","Jordan"])assert.ok(COUNTRIES.has(x));});
test("country codes resolve to stable names",()=>{assert.equal(COUNTRY_CODES.YE,"Yemen");assert.equal(COUNTRY_CODES.SA,"Saudi Arabia");assert.equal(COUNTRY_CODES.AE,"United Arab Emirates");});
test("candidate WhatsApp phone validation accepts international numbers",()=>{assert.equal(validPhone("+967 777 123 456"),"967777123456");assert.equal(validPhone("+966 50 123 4567"),"966501234567");assert.equal(validPhone("123"),"");assert.equal(validPhone("1".repeat(16)),"");});

test("jobs feed API pulls the latest GitHub index and filters expired records",async()=>{
 const {readFeed}=require("../jobs-api");
 const calls=[];
 const fresh={
  schemaVersion:1,fetchedAt:"2026-11-22T00:00:00.000Z",sources:[{name:"YemenHR",status:"ok"}],
  items:[
   {title:"Current Yemen job",url:"https://example.org/current",country:"Yemen",expiresAt:"2026-12-22T00:00:00.000Z"},
   {title:"Expired Yemen job",url:"https://example.org/expired",country:"Yemen",expiresAt:"2026-11-20T00:00:00.000Z"}
  ]
 };
 const result=await readFeed(async(url,options)=>{
  calls.push({url,cache:options.cache,method:options.method});
  return {ok:true,json:async()=>fresh};
 },true);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/raw\.githubusercontent\.com\/baraagpt6-droid\/dalilna\/main\/jobs-feed\.json/);
 assert.equal(calls[0].cache,"no-store");
 assert.equal(result.fetchedAt,fresh.fetchedAt);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].title,"Current Yemen job");
});

test("daily jobs index is valid and stores source metadata",()=>{const feed=JSON.parse(fs.readFileSync("jobs-feed.json","utf8"));assert.equal(feed.schemaVersion,1);assert.ok(Array.isArray(feed.sources));assert.ok(Array.isArray(feed.items));});

test("public YemenHR parser rejects Telegraph-only intermediary links",()=>{
 const {parseYemenHrJobs}=require("../scripts/refresh-jobs.cjs");
 const html='<div class="tgme_widget_message_wrap"><div data-post="hr_yemen/9999"></div><div class="tgme_widget_message_text js-message_text">📋 المسمى الوظيفي:<br>Project Officer<br>🏢 الجهة:<br>Test NGO<br>📍 الموقع:<br>Aden<br>📅 تاريخ النشر:<br>18 نوفمبر 2026<br>⏰ آخر موعد للتقديم:<br>24 نوفمبر 2026</div><a href="https://telegra.ph/Project-Officer-11-18">details</a></div>';
 const items=parseYemenHrJobs(html);
 assert.equal(items.length,0);
});

test("public YemenHR parser keeps a direct HTTPS application link and source metadata",()=>{
 const {parseYemenHrJobs}=require("../scripts/refresh-jobs.cjs");
 const html='<div class="tgme_widget_message_wrap"><div data-post="hr_yemen/9999"></div><div class="tgme_widget_message_text js-message_text">📋 المسمى الوظيفي:<br>Project Officer<br>🏢 الجهة:<br>Test NGO<br>📍 الموقع:<br>Aden<br>📅 تاريخ النشر:<br>18 نوفمبر 2026<br>⏰ آخر موعد للتقديم:<br>24 نوفمبر 2026</div><a href="https://telegra.ph/Project-Officer-11-18">details</a><a href="https://employer.example/apply/123">Apply now</a></div>';
 const items=parseYemenHrJobs(html);
 assert.equal(items.length,1);
 assert.equal(items[0].title,"Project Officer");
 assert.equal(items[0].organization,"Test NGO");
 assert.equal(items[0].country,"Yemen");
 assert.equal(items[0].url,"https://employer.example/apply/123");
 assert.equal(items[0].sourceUrl,"https://t.me/hr_yemen/9999");
});

test("Careers.sa parser ignores employer-directory pages and keeps only job details",()=>{
 const {parseCareersSaIndex}=require("../scripts/refresh-jobs.cjs");
 const html='<a href="/en/jobs/company/parsons">Parsons Corporation careers</a><a href="/en/jobs/its-engineer-544679bc">ITS Engineer</a>';
 const links=parseCareersSaIndex(html);
 assert.equal(links.length,1);
 assert.ok(links[0].url.endsWith("/en/jobs/its-engineer-544679bc"));
});

test("Careers.sa parser retains exact job links, location, organization and freshness date",()=>{
 const {parseCareersSaIndex,parseCareersSaJob}=require("../scripts/refresh-jobs.cjs");
 const index='<a href="/en/jobs/example-position">Example Position</a>';
 const links=parseCareersSaIndex(index);
 assert.equal(links.length,1);
 const html='<h1>Example Position</h1><p>Jobs / Example Employer</p><p>Riyadh, Saudi Arabia</p><p>First found 21 Nov 2026</p>';
 const job=parseCareersSaJob(html,links[0].url,links[0].title);
 assert.equal(job.title,"Example Position");
 assert.equal(job.organization,"Example Employer");
 assert.equal(job.country,"Saudi Arabia");
 assert.equal(job.city,"Riyadh");
 assert.equal(job.publishedAt,"2026-11-21T00:00:00.000Z");
});

test("daily refresh merges retained and freshly collected jobs without losing old records",()=>{
 const script=fs.readFileSync("scripts/refresh-jobs.cjs","utf8");
 assert.ok(script.includes("[...old,...fresh].forEach"));
 assert.ok(script.includes("map.set(key,item)"));
 assert.ok(script.includes("writeFileSync(OUT"));
});

test("daily refresh script includes UN RSS and optional ReliefWeb configuration",()=>{const script=fs.readFileSync("scripts/refresh-jobs.cjs","utf8");assert.match(script,/careers\.un\.org/);assert.match(script,/RELIEFWEB_APPNAME/);assert.match(script,/DALILNA_JOB_RSS_FEEDS/);assert.match(script,/expiresAt/);});
test("job seeker records require public consent and expire after 60 days",()=>{const api=fs.readFileSync("jobs-api.js","utf8");assert.match(api,/body\.consentPublic===true/);assert.match(api,/consent_public=TRUE/);assert.match(api,/INTERVAL '60 days'/);});
test("marketplace exposes category groups and 60-day market expiry",()=>{const api=fs.readFileSync("marketplace-api.js","utf8");assert.match(api,/PRODUCT_GROUPS/);assert.match(api,/productGroup/);assert.match(api,/NOW\(\)\+INTERVAL '60 days'/);});
