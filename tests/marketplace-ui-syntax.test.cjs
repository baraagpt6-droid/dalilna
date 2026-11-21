"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const html=fs.readFileSync("index.html","utf8");
const client=fs.readFileSync("marketplace-client.js","utf8");
const inline=[...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
 .filter(match=>!/\\bsrc\\s*=/.test(match[1])&&match[2].trim())
 .map(match=>match[2]);
test("all inline JavaScript in the PWA parses",()=>{
 assert.ok(inline.length>=2,"expected inline application scripts");
 inline.forEach((code,index)=>new vm.Script(code,{filename:"index.html:inline-script-"+index}));
});
test("shared marketplace client parses",()=>{
 new vm.Script(client,{filename:"marketplace-client.js"});
});
test("PWA and Android WebView marketplace assets stay byte-for-byte aligned",()=>{
 for(const name of ["index.html","sw.js","marketplace-client.js"]) {
  assert.equal(fs.readFileSync("android/app/src/main/assets/"+name,"utf8"),fs.readFileSync(name,"utf8"),name+" differs between web and Android");
 }
});
test("marketplace form exposes the requested product subtypes",()=>{
 for(const item of ["phone","watch","car","motorcycle","land","property","honey","coffee","livestock"])assert.ok(html.includes('value="'+item+'"'),"missing product subtype "+item);
});
