"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseYemenHrJobs,dedupeJobs}=require("../scripts/refresh-jobs.cjs");

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

test("job refresh removes expired records and duplicate IDs with different application URLs",()=>{
 const now=Date.parse("2026-11-23T00:00:00Z");
 const base={id:"yemenhr:abc",title:"Field Assistant",organization:"Example",location:"Ibb, Yemen",country:"Yemen",countryCode:"YE",publishedAt:"2026-11-22T00:00:00Z",url:"https://yemenhr.com/jobs/first",applicationUrl:"https://yemenhr.com/jobs/first",expiresAt:"2026-11-30T00:00:00Z",sourceUrl:"https://t.me/hr_yemen/123"};
 const richer={...base,url:"https://yemenhr.com/jobs/second",applicationUrl:"https://yemenhr.com/jobs/second",summaryAr:"وصف الوظيفة ومؤهلاتها",deadline:"30 نوفمبر"};
 const expired={...base,id:"yemenhr:old",expiresAt:"2026-11-22T00:00:00Z"};
 const rows=dedupeJobs([base,richer,expired],now);
 assert.equal(rows.length,1);
 assert.equal(rows[0].applicationUrl,"https://yemenhr.com/jobs/second");
 assert.equal(rows[0].summaryAr,"وصف الوظيفة ومؤهلاتها");
});
