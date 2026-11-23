"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=name=>fs.readFileSync(path.join(root,name),"utf8");
test("v3 app files load in PWA and Android WebView assets",()=>{
 const html=read("index.html");assert.equal(html,read("android/app/src/main/assets/index.html"));
 assert.ok(html.includes("v3.0.0.css?v=3.0.0"));assert.ok(html.includes("v3.0.0.js?v=3.0.0"));
 assert.equal(read("v3.0.0.js"),read("android/app/src/main/assets/v3.0.0.js"));
 assert.equal(read("v3.0.0.css"),read("android/app/src/main/assets/v3.0.0.css"));
});
test("saved hub, animation, job filters and local assistant source labels are wired",()=>{
 const js=read("v3.0.0.js"),features=read("features-2.1.js"),app=read("index.html");
 assert.doesNotThrow(()=>new Function(js));
 assert.doesNotThrow(()=>new Function(features));
 assert.ok(js.includes("dalilna:favorite-change"));assert.ok(js.includes("cubic-bezier"));assert.ok(js.includes("savedHubDialog"));
 assert.ok(features.includes("jobsInlineSearch"));assert.ok(features.includes("jobsSavedFilter"));assert.ok(features.includes("dalilna-job-favs-records-v1"));
 assert.ok(features.includes("التقديم عبر صفحة المصدر"));assert.ok(app.includes("assistant-origin-badge"));assert.ok(app.includes("المجيب: دليلنا المحلي"));
});
