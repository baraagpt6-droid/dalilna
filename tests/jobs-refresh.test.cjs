"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseYemenHrJobs}=require("../scripts/refresh-jobs.cjs");

function fixture(applicationUrl){
 return `<div class="tgme_widget_message_wrap">
 <div class="tgme_widget_message_text">
 المسمى الوظيفي: مسؤول ميداني
 الجهة: منظمة مثال
 الموقع: إب
 تاريخ النشر: 22 نوفمبر 2026
 المؤهلات: بكالوريوس وخبرة في العمل الميداني والتواصل المجتمعي.
 آخر موعد للتقديم: 30 نوفمبر 2026
 ${applicationUrl?'<a href="'+applicationUrl+'">التقديم</a>':'<a href="https://example.invalid/apply">رابط غير رسمي</a>'}
 </div><span data-post="hr_yemen/12345"></span></div>`;
}

test("YemenHR parser keeps an official application URL separate from the source post",()=>{
 const [job]=parseYemenHrJobs(fixture("https://yemenhr.com/jobs/12345"));
 assert.ok(job);
 assert.equal(job.applicationUrl,"https://yemenhr.com/jobs/12345");
 assert.match(job.url,/^https:\/\//);
 assert.match(job.summaryAr,/بكالوريوس/);
 assert.equal(job.deadline,"30 نوفمبر 2026");
});

test("Telegram, Telegraph and reserved test domains never become published job links",()=>{
 const items=parseYemenHrJobs(fixture(""));
 assert.equal(items.length,0);
 assert.equal(parseYemenHrJobs(fixture("https://telegra.ph/temporary-application-link")).length,0);
 assert.equal(parseYemenHrJobs(fixture("https://example.invalid/apply")).length,0);
});

test("YemenHR parser publishes only a direct application URL supplied by the source",()=>{
 const [job]=parseYemenHrJobs(fixture("https://yemenhr.com/apply/12345"));
 assert.ok(job);
 assert.equal(job.applicationUrl,"https://yemenhr.com/apply/12345");
 assert.equal(job.url,job.applicationUrl);
 assert.equal(job.sourceUrl,"https://t.me/hr_yemen/12345");
 assert.doesNotMatch(job.url,/telegra\\.ph|t\\.me/i);
});
