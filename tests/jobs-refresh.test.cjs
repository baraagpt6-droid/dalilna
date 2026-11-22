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

test("Telegram and Telegraph links are not exposed as official application URLs",()=>{
 const [job]=parseYemenHrJobs(fixture(""));
 assert.ok(job);
 assert.equal(job.applicationUrl,"");
 assert.match(job.url,/t\.me\/hr_yemen/);
});

test("YemenHR parser never emits Telegraph intermediary links",()=>{
 const [job]=parseYemenHrJobs(fixture("https://telegra.ph/temporary-application-link"));
 assert.ok(job);
 assert.doesNotMatch(job.url,/telegra\.ph/i);
 assert.doesNotMatch(job.sourceUrl,/telegra\.ph/i);
 assert.equal(job.applicationUrl,"");
});
