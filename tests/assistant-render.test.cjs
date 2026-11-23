"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { server } = require("../server");

const nativeFetch = global.fetch.bind(globalThis);
const originalApiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
let baseUrl;

test.before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = "http://127.0.0.1:" + address.port;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});

test("PWA and Android route cloud assistant requests to Render with a Vercel fallback", () => {
  const root = path.resolve(__dirname, "..");
  const web = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const android = fs.readFileSync(path.join(root, "android/app/src/main/assets/index.html"), "utf8");
  assert.equal(web, android, "Android WebView assets must match the PWA");
  assert.match(web, /https:\/\/dalilna-live\.onrender\.com\/api\/assistant/);
  assert.match(web, /https:\/\/dalilna-oavk\.vercel\.app\/api\/assistant/);
  assert.match(web, /function assistantFallbackApiUrl\(\)/);
  assert.match(web, /cloud_ai_not_configured/);
});

test("assistant status reveals only whether the Gemini key is configured", async () => {
  delete process.env.GEMINI_API_KEY;
  const response = await nativeFetch(baseUrl + "/api/assistant/status");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, "Gemini");
  assert.equal(payload.configured, false);
  assert.equal(payload.model, "gemini-3.8-flash");
  assert.equal(JSON.stringify(payload).includes("GEMINI_API_KEY"), false);
});

test("Vercel-compatible GET assistant endpoint exposes only key presence", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  try {
    const response = await nativeFetch(baseUrl + "/api/assistant", {
      headers: { Origin: "https://dalilna-oavk.vercel.app" }
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.provider, "Gemini");
    assert.equal(payload.configured, true);
    assert.equal(payload.model, "gemini-3.8-flash");
    assert.equal(JSON.stringify(payload).includes("test-only-not-a-real-key"), false);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test("assistant route returns a clear 503 when the server key is not configured", async () => {
  delete process.env.GEMINI_API_KEY;
  const response = await nativeFetch(baseUrl + "/api/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dalilna-yemen.onrender.com"
    },
    body: JSON.stringify({ question: "عرفني بدليلنا" })
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cloud_ai_not_configured" });
});

test("assistant route rejects unapproved browser origins", async () => {
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  const response = await nativeFetch(baseUrl + "/api/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unapproved.example"
    },
    body: JSON.stringify({ question: "اختبار" })
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
});

test("assistant route proxies Gemini server-side and never returns the API key", async () => {
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  process.env.GEMINI_MODEL = "gemini-3.8-flash";
  let upstreamRequest;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    upstreamRequest = { url: String(url), options };
    return new Response(JSON.stringify({
      output_text: "أهلاً بك في دليلنا."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await nativeFetch(baseUrl + "/api/assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://dalilna-yemen.onrender.com"
      },
      body: JSON.stringify({
        question: "عرفني بدليلنا",
        context: { region: "إب" }
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.answer, "أهلاً بك في دليلنا.");
    assert.equal(payload.mode, "gemini");
    assert.match(upstreamRequest.url, /generativelanguage\.googleapis\.com\/v1beta\/interactions$/);
    assert.equal(upstreamRequest.options.headers["x-goog-api-key"], "test-only-not-a-real-key");
    assert.equal(JSON.stringify(payload).includes("test-only-not-a-real-key"), false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  }
});

test("assistant preflight advertises POST for the Render-backed endpoint", async () => {
  const response = await nativeFetch(baseUrl + "/api/assistant", {
    method: "OPTIONS",
    headers: {
      Origin: "https://dalilna-yemen.onrender.com",
      "Access-Control-Request-Method": "POST"
    }
  });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  assert.match(response.headers.get("access-control-allow-methods") || "", /GET/);
});

test("local assistant fallback renders before cloud requests, including HTTP 503",()=>{
 const root=path.resolve(__dirname,"..");
 const web=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const serviceImmediate=web.indexOf('if(!localHits.length&&typeof onImmediate==="function")');
 const serviceCloud=web.indexOf("requestCloudAssistant(q,assistantContext)",serviceImmediate);
 assert.ok(serviceImmediate>=0&&serviceCloud>serviceImmediate);
 const genericImmediate=web.indexOf("const localFallback={answer:answerAI(q)");
 const genericCloud=web.indexOf("requestCloudAssistant(q,buildAssistantContext(q))",genericImmediate);
 assert.ok(genericImmediate>=0&&genericCloud>genericImmediate);
 assert.ok(web.includes("response.status===404||response.status===503"));
 assert.ok(web.includes('!["provider_timeout","provider_rate_limit"].includes(data.error)'));
});
 
test("Gemini request budget allows slower responses while local answers render first",()=>{
 const root=path.resolve(__dirname,"..");
 const api=fs.readFileSync(path.join(root,"api/assistant.js"),"utf8");
 const web=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.ok(api.includes('AbortSignal.timeout(model === "gemini-3.5-flash-lite" ? 10_000 : 15_000)'));
 assert.ok(api.includes('const fallbackModel = preferredModel === "gemini-3.5-flash-lite" ? "gemini-3.8-flash" : "gemini-3.5-flash-lite"'));
 assert.ok(api.includes("for (const model of modelCandidates)"));
 assert.match(web,/timer=setTimeout\(\(\)=>controller\.abort\(\),18000\)/);
 const jobs=web.indexOf('const response=await fetch("./jobs-feed.json"');
 const immediate=web.indexOf('if(typeof onImmediate==="function")onImmediate(result)',jobs);
 const cloud=web.indexOf('requestCloudAssistant(q,{localJobs:',jobs);
 assert.ok(jobs>=0&&immediate>jobs&&cloud>immediate,"local jobs result must render before cloud fallback");
});

test("Gemini proxy falls back to Flash-Lite after primary rate limiting", async () => {
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  process.env.GEMINI_MODEL = "gemini-3.8-flash";
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({url:String(url),body:JSON.parse(options.body)});
    if(calls.length===1) return new Response(JSON.stringify({error:{status:"RESOURCE_EXHAUSTED"}}),{
      status:429,headers:{"Content-Type":"application/json"}
    });
    return new Response(JSON.stringify({model:"gemini-3.5-flash-lite",output_text:"إجابة احتياطية سريعة."}),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  try {
    const response = await nativeFetch(baseUrl + "/api/assistant",{
      method:"POST",
      headers:{"Content-Type":"application/json",Origin:"https://dalilna-yemen.onrender.com"},
      body:JSON.stringify({question:"اختبار المساعد",context:{}})
    });
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(payload.answer,"إجابة احتياطية سريعة.");
    assert.equal(payload.model,"gemini-3.5-flash-lite");
    assert.equal(calls.length,2);
    assert.equal(calls[0].body.model,"gemini-3.8-flash");
    assert.equal(calls[1].body.model,"gemini-3.5-flash-lite");
  } finally {
    global.fetch=originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  }
});
