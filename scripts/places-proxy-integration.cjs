"use strict";
const assert=require("node:assert/strict");
const http=require("node:http");
const {server}=require("../server");
const originalFetch=global.fetch;
let base="";
const write=message=>process.stdout.write(message+String.fromCharCode(10));
function jsonResponse(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}});}
function get(path,ip){return new Promise((resolve,reject)=>{
 const req=http.get({host:"127.0.0.1",port:Number(new URL(base).port),path,headers:{"x-forwarded-for":ip,accept:"application/json"}},res=>{
  const chunks=[];res.on("data",chunk=>chunks.push(Buffer.from(chunk)));res.on("end",()=>resolve({status:res.statusCode,body:Buffer.concat(chunks)}));
 });req.on("error",reject);req.setTimeout(25000,()=>req.destroy(new Error("HTTP integration request timed out")));
});}
async function main(){
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 base="http://127.0.0.1:"+server.address().port;
 try{
  let r=await get("/api/places/status","198.51.100.1");assert.equal(r.status,200);
  let status=JSON.parse(r.body);assert.equal(status.activeProvider,"OpenStreetMap");assert.equal(status.paidProvidersDisabled,true);assert.equal(status.photoProvider,"Wikimedia Commons");
  write("PASS provider status confirms open sources only");
  let hosts=[];
  global.fetch=async(input,options={})=>{const url=new URL(String(input));hosts.push(url.hostname);assert.notEqual(url.hostname,"places.googleapis.com");assert.notEqual(url.hostname,"maps.googleapis.com");assert.equal(url.hostname,"overpass-api.de");assert.equal(options.method,"POST");return jsonResponse({elements:[{type:"node",id:123456,lat:15.3694,lon:44.1910,tags:{name:"مطعم اختبار",amenity:"restaurant",cuisine:"yemeni",phone:"777123456"}}]});};
  let q=new URLSearchParams({q:"مطعم",category:"food",lat:"15.3694",lon:"44.1910",radius:"5000"});
  r=await get("/api/places/search?"+q,"198.51.100.2");assert.equal(r.status,200);let payload=JSON.parse(r.body);assert.equal(payload.source,"OpenStreetMap");assert.equal(payload.count,1);assert.equal(payload.items[0].cuisine,"yemeni");assert.match(payload.items[0].mapsUrl,/openstreetmap.org/);assert.deepEqual(hosts,["overpass-api.de"]);
  write("PASS HTTP OSM search maps and normalizes business tags");
  hosts=[];
  global.fetch=async input=>{const host=new URL(String(input)).hostname;hosts.push(host);if(host==="overpass-api.de")return jsonResponse({busy:true},503);if(host==="overpass.private.coffee")return jsonResponse({elements:[{type:"node",id:7788,lat:15.3712,lon:44.1922,tags:{name:"مطعم احتياطي",amenity:"restaurant"}}]});throw new Error("Unexpected provider "+host);};
  q=new URLSearchParams({q:"مطعم",category:"food",lat:"15.3712",lon:"44.1922",radius:"5000"});r=await get("/api/places/search?"+q,"198.51.100.3");assert.equal(r.status,200);payload=JSON.parse(r.body);assert.equal(payload.items[0].name,"مطعم احتياطي");assert.deepEqual(hosts,["overpass-api.de","overpass.private.coffee"]);
  write("PASS Overpass failover when primary mirror is busy");
  hosts=[];
  global.fetch=async input=>{const host=new URL(String(input)).hostname;hosts.push(host);if(host==="overpass-api.de")return jsonResponse({elements:[],remark:"runtime error: Query timed out"});if(host==="overpass.private.coffee")return jsonResponse({elements:[{type:"node",id:8899,lat:15.3722,lon:44.1932,tags:{name:"مطعم بعد retry",amenity:"restaurant"}}]});throw new Error("Unexpected provider "+host);};
  q=new URLSearchParams({q:"مطعم",category:"food",lat:"15.3722",lon:"44.1932",radius:"5000"});r=await get("/api/places/search?"+q,"198.51.100.4");assert.equal(r.status,200);payload=JSON.parse(r.body);assert.equal(payload.items[0].name,"مطعم بعد retry");assert.deepEqual(hosts,["overpass-api.de","overpass.private.coffee"]);
  write("PASS incomplete Overpass remark triggers mirror failover");
   global.fetch=async(input,options={})=>{const url=new URL(String(input));assert.equal(url.hostname,"commons.wikimedia.org");assert.ok(String(options.headers["User-Agent"]).includes("DalilnaDirectory/1.8.2"));return jsonResponse({query:{pages:[{title:"File:Test.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/test.jpg",descriptionurl:"https://commons.wikimedia.org/wiki/File:Test.jpg",extmetadata:{Artist:{value:"Photographer"},LicenseShortName:{value:"CC BY-SA 4.0"}}}]}]}});};
  r=await get("/api/places/photos?q=Unique%20Commons%20integration","198.51.100.5");assert.equal(r.status,200);payload=JSON.parse(r.body);assert.equal(payload.source,"Wikimedia Commons");assert.equal(payload.items[0].author,"Photographer");assert.equal(payload.items[0].license,"CC BY-SA 4.0");
  write("PASS Commons image search returns author and license attribution");
  global.fetch=async()=>{throw new Error("Paid provider must never be contacted");};
  r=await get("/api/places/details?placeId=ChIJOldGooglePlaceId123","198.51.100.6");assert.equal(r.status,404);
  r=await get("/api/places/photo?placeId=ChIJOldGooglePlaceId123&photoName=x","198.51.100.7");assert.equal(r.status,404);
  write("PASS retired Google details and photo routes are unavailable");
  write("RESULT: 6 open-data HTTP integration checks passed");
 }finally{global.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{process.stderr.write((error&&error.stack)||String(error));process.exitCode=1;if(server.listening)server.close();});