"use strict";

const http = require("node:http");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 10000);
const VERSION = "1.5.0";
const ALLOWED_ORIGINS = new Set([
  "https://dalilna-yemen.onrender.com",
  "https://dalilna-live.onrender.com",
  "https://dalilna-yemen.vercel.app",
  "https://baraagpt6-droid.github.io",
  "https://appassets.androidplatform.net",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
]);
const CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;
const resultCache = new Map();
const geocodeCache = new Map();
const rateBuckets = new Map();
let lastGeocodeAt = 0;

const FILTERS = {
  all: [
    '["shop"]',
    '["amenity"~"^(pharmacy|hospital|clinic|doctors|dentist|restaurant|fast_food|cafe|school|college|university|kindergarten|marketplace|bank|atm|fuel|bus_station|taxi|place_of_worship|post_office|events_venue)$"]',
    '["tourism"~"^(hotel|guest_house|hostel)$"]',
    '["office"="government"]',
    '["craft"]'
  ],
  grocery: ['["shop"~"^(convenience|grocery|supermarket|general)$"]', '["amenity"="marketplace"]'],
  food: ['["amenity"~"^(restaurant|fast_food)$"]', '["shop"="bakery"]'],
  cafe: ['["amenity"="cafe"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  health: ['["amenity"~"^(hospital|clinic|doctors|dentist)$"]'],
  edu: ['["amenity"~"^(school|college|university|kindergarten)$"]'],
  gov: ['["office"="government"]'],
  money: ['["amenity"~"^(bank|atm|bureau_de_change)$"]'],
  craft: ['["craft"]', '["shop"="hardware"]'],
  transport: ['["amenity"~"^(bus_station|taxi)$"]', '["public_transport"="station"]'],
  mosque: ['["amenity"="place_of_worship"]["religion"="muslim"]', '["building"="mosque"]'],
  hotel: ['["tourism"~"^(hotel|guest_house|hostel)$"]'],
  market: ['["amenity"="marketplace"]'],
  solar: ['["shop"~"^(electronics|electrical|hardware)$"]'],
  parts: ['["shop"="car_parts"]'],
  build: ['["shop"="building_materials"]'],
  clothes: ['["shop"~"^(clothes|shoes)$"]'],
  home: ['["shop"~"^(furniture|houseware|appliance)$"]'],
  books: ['["shop"~"^(books|stationery)$"]'],
  beauty: ['["shop"~"^(beauty|cosmetics|perfumery)$"]'],
  salon: ['["shop"="hairdresser"]'],
  laundry: ['["shop"="laundry"]'],
  delivery: ['["amenity"="post_office"]', '["shop"="parcel"]'],
  utility: ['["shop"~"^(gas|propane)$"]'],
  gold: ['["shop"="jewelry"]'],
  wedding: ['["amenity"="events_venue"]'],
  farm: ['["shop"~"^(agrarian|garden_centre|farm)$"]']
};

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function cleanText(value, max = 160) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeText(value) {
  return cleanText(value, 220)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function touchCache(cache, key, value, ttl = CACHE_TTL_MS) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  return value;
}

function readCache(cache, key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function rateLimit(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < 60_000);
  if (bucket.length >= 8) {
    rateBuckets.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  if (rateBuckets.size > 3000) {
    for (const [key, values] of rateBuckets) {
      if (!values.length || now - values[values.length - 1] > 60_000) rateBuckets.delete(key);
    }
  }
  return true;
}

function buildOverpassQuery(bbox, category) {
  const filters = FILTERS[category] || FILTERS.all;
  const box = [bbox.south, bbox.west, bbox.north, bbox.east].map(n => Number(n).toFixed(6)).join(",");
  const union = filters.map(filter => "nwr" + filter + "(" + box + ");").join("\n");
  return "[out:json][timeout:12][maxsize:134217728];\n(\n" + union + "\n);\nout center tags 80;";
}

function classifyCategory(tags) {
  const shop = String(tags.shop || "").toLowerCase();
  const amenity = String(tags.amenity || "").toLowerCase();
  const tourism = String(tags.tourism || "").toLowerCase();
  const office = String(tags.office || "").toLowerCase();
  const craft = String(tags.craft || "").toLowerCase();
  if (["convenience", "grocery", "supermarket", "general"].includes(shop) || amenity === "marketplace") return "grocery";
  if (amenity === "pharmacy") return "pharmacy";
  if (["hospital", "clinic", "doctors", "dentist"].includes(amenity)) return "health";
  if (["restaurant", "fast_food"].includes(amenity) || shop === "bakery") return "food";
  if (amenity === "cafe") return "cafe";
  if (["school", "college", "university", "kindergarten"].includes(amenity)) return "edu";
  if (office === "government") return "gov";
  if (["bank", "atm", "bureau_de_change"].includes(amenity)) return "money";
  if (amenity === "place_of_worship" || tags.building === "mosque") return "mosque";
  if (["hotel", "guest_house", "hostel"].includes(tourism)) return "hotel";
  if (shop === "hairdresser") return "salon";
  if (shop === "laundry") return "laundry";
  if (shop === "car_parts") return "parts";
  if (shop === "building_materials") return "build";
  if (shop === "jewelry") return "gold";
  if (shop === "clothes" || shop === "shoes") return "clothes";
  if (shop === "books" || shop === "stationery") return "books";
  if (shop === "furniture" || shop === "houseware" || shop === "appliance") return "home";
  if (shop === "beauty" || shop === "cosmetics" || shop === "perfumery") return "beauty";
  if (shop === "electronics" || shop === "electrical") return "solar";
  if (shop === "hardware") return "build";
  if (craft) return "craft";
  if (amenity === "bus_station" || amenity === "taxi") return "transport";
  if (amenity === "post_office" || shop === "parcel") return "delivery";
  if (amenity === "fuel" || shop === "gas" || shop === "propane") return "utility";
  if (amenity === "events_venue") return "wedding";
  if (shop === "agrarian" || shop === "garden_centre" || shop === "farm") return "farm";
  return "other";
}

function normalizeElement(element, placeLabel) {
  const tags = element.tags || {};
  const name = cleanText(tags["name:ar"] || tags.name || tags.brand || tags.operator, 140);
  if (!name) return null;
  const center = element.center || {};
  const lat = Number(element.lat !== undefined ? element.lat : center.lat);
  const lon = Number(element.lon !== undefined ? element.lon : center.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = cleanText([
    tags["addr:full"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:district"]
  ].filter(Boolean).join("، "), 220);
  const phone = cleanText(tags["contact:phone"] || tags.phone || tags["contact:mobile"] || "", 50);
  const websiteRaw = cleanText(tags["contact:website"] || tags.website || "", 240);
  let website = "";
  try {
    const parsed = new URL(websiteRaw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") website = parsed.href;
  } catch (_) {}
  const mapQuery = encodeURIComponent(name + " " + lat + "," + lon);
  return {
    id: "osm-" + element.type + "-" + element.id,
    name,
    category: classifyCategory(tags),
    address: address || placeLabel,
    phone,
    website,
    openingHours: cleanText(tags.opening_hours || "", 100),
    lat,
    lon,
    sourceUrl: "https://www.openstreetmap.org/" + element.type + "/" + element.id,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + mapQuery
  };
}

async function geocodePlace(place) {
  const key=normalizeText(place);
  const cached=readCache(geocodeCache,key);
  if(cached)return cached;
  const cleanedPlace=cleanText(place.replace(/\b(?:محافظة|مديرية|عزلة)\s*/g," ").replace(/،\s*اليمن$/g,"").replace(/\s+/g," "),180);
  const candidates=[...new Set([place,cleanedPlace+"، اليمن"].filter(Boolean))];
  let lastError=null;
  for(const candidate of candidates){
    const wait=Math.max(0,1100-(Date.now()-lastGeocodeAt));
    if(wait)await sleep(wait);
    lastGeocodeAt=Date.now();
    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.search=new URLSearchParams({q:candidate,format:"jsonv2",addressdetails:"1",limit:"5",countrycodes:"ye","accept-language":"ar,en"}).toString();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json","User-Agent":"DalilnaYemenDirectory/1.5.2 (+https://dalilna-yemen.vercel.app)","Referer":"https://dalilna-yemen.vercel.app/"}});
      if(response.status===429){lastError=new Error("مصدر تحديد المنطقة مزدحم. حاول مرة أخرى بعد قليل.");continue;}
      if(!response.ok){lastError=new Error("تعذّر تحديد حدود المنطقة من مصدر الخريطة.");continue;}
      const rows=await response.json();
      if(!Array.isArray(rows)||!rows.length)continue;
      for(const row of rows){
        if(row.address?.country_code&&row.address.country_code!=="ye")continue;
        const bounds=Array.isArray(row.boundingbox)?row.boundingbox.map(Number):[];
        if(bounds.length!==4||!bounds.every(Number.isFinite))continue;
        const bbox={south:bounds[0],north:bounds[1],west:bounds[2],east:bounds[3]};
        if(bbox.north<=bbox.south||bbox.east<=bbox.west)continue;
        const spanLat=bbox.north-bbox.south,spanLon=bbox.east-bbox.west;
        if(spanLat>2.8||spanLon>2.8||spanLat*spanLon>5.5){const error=new Error("المنطقة واسعة جداً للبحث المباشر. اختر مديرية أو منطقة أصغر.");error.statusCode=400;throw error;}
        return touchCache(geocodeCache,key,{bbox,label:cleanText(row.display_name||candidate,220),osmType:row.osm_type||"",osmId:row.osm_id||null},12*60*60*1000);
      }
    }catch(error){
      if(error.statusCode)throw error;
      lastError=error.name==="AbortError"?new Error("تأخر مصدر تحديد المنطقة في الرد."):error;
    }finally{clearTimeout(timer);}
  }
  if(lastError)throw lastError;
  return null;
}
async function fetchOverpass(bbox,category,label){
  const query=buildOverpassQuery(bbox,category);
  const endpoints=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
  let lastError=null;
  for(const [index,endpoint] of endpoints.entries()){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),index===0?12000:10000),startedAt=Date.now();
    try{
      const response=await fetch(endpoint,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","Accept":"application/json","User-Agent":"DalilnaYemenDirectory/1.5.2 (+https://dalilna-yemen.vercel.app)"},body:new URLSearchParams({data:query})});
      if([429,503,504].includes(response.status)){lastError=new Error("مصدر بيانات الأماكن مشغول حالياً.");continue;}
      if(!response.ok){lastError=new Error("تعذّر جلب بيانات الأماكن من المصدر المفتوح.");continue;}
      const body=await response.json(),elements=Array.isArray(body.elements)?body.elements:[],items=elements.map(item=>normalizeElement(item,label)).filter(Boolean),seen=new Set();
      const unique=items.filter(item=>{const key=normalizeText(item.name)+"|"+item.lat.toFixed(4)+"|"+item.lon.toFixed(4);if(seen.has(key))return false;seen.add(key);return true;});
      console.info(JSON.stringify({event:"places.overpass.success",endpoint:index+1,category,count:unique.length,durationMs:Date.now()-startedAt}));
      return unique.slice(0,80);
    }catch(error){lastError=error.name==="AbortError"?new Error("انتهت مهلة مصدر الخريطة."):error;}
    finally{clearTimeout(timer);}
  }
  throw lastError||new Error("مصدر بيانات الأماكن غير متاح حالياً.");
}
async function searchPlaces(params) {
  const place = cleanText(params.place, 180);
  const fallbackPlace = cleanText(params.fallbackPlace, 180);
  const category = FILTERS[params.category] ? params.category : "all";
  const query = cleanText(params.q, 100);
  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const radius = Math.min(15000, Math.max(1000, Number(params.radius) || 7000));
  if ((!place || normalizeText(place) === "اليمن" || normalizeText(place) === "yemen") && !hasCoordinates) {
    const error = new Error("اختر محافظة أو مديرية أولاً، أو فعّل البحث حول موقعك.");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = (hasCoordinates ? "near:" + lat.toFixed(3) + ":" + lon.toFixed(3) : normalizeText(place)) + "|" + category;
  const cached = readCache(resultCache, cacheKey);
  if (cached) {
    const copy = { ...cached, fetchedAt: new Date().toISOString(), cached: true };
    return filterByQuery(copy, query, category);
  }

  let area = null;
  let scopeFallback = false;
  let usedPlace = place || "بالقرب من موقعك";
  if (hasCoordinates) {
    const latDelta = radius / 111000;
    const lonDelta = radius / (111000 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    area = { bbox: { south: lat - latDelta, north: lat + latDelta, west: lon - lonDelta, east: lon + lonDelta }, label: "بالقرب من موقعك" };
  } else {
    area = await geocodePlace(place);
  }
  if (!area && fallbackPlace && normalizeText(fallbackPlace) !== normalizeText(place)) {
    area = await geocodePlace(fallbackPlace);
    scopeFallback = true;
    usedPlace = fallbackPlace;
  }
  if (!area) {
    const error = new Error("لم نعثر على حدود هذه المديرية في بيانات الخريطة. جرّب اختيار المحافظة أو افتح البحث في خرائط Google.");
    error.statusCode = 404;
    throw error;
  }

  const items = await fetchOverpass(area.bbox, category, area.label || usedPlace);
  const result = {
    category,
    items,
    count: items.length,
    source: "OpenStreetMap",
    attribution: "© OpenStreetMap contributors",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    place: usedPlace,
    geocodedPlace: area.label,
    scopeFallback,
    fetchedAt: new Date().toISOString(),
    cached: false,
    note: "قد تكون بيانات الخريطة غير مكتملة أو قديمة. تحقق من رقم التواصل وساعات العمل قبل الزيارة."
  };
  touchCache(resultCache, cacheKey, result);
  return filterByQuery(result, query, category);
}

function filterByQuery(result, query, category) {
  if (!query || category !== "all") return result;
  const words = normalizeText(query).split(/\s+/).filter(word => word.length > 2);
  if (!words.length) return result;
  const items = result.items.filter(item => {
    const haystack = normalizeText(item.name + " " + item.address);
    return words.some(word => haystack.includes(word));
  });
  return { ...result, items, count: items.length };
}

function serveStatic(req, res, pathname) {
  const fs = require("node:fs");
  const path = require("node:path");
  let filePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const root = path.resolve(__dirname);
  const full = path.resolve(root, filePath);
  if (!full.startsWith(root + path.sep) && full !== path.join(root, "index.html")) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  let actual = full;
  try {
    if (fs.statSync(actual).isDirectory()) actual = path.join(actual, "index.html");
    const data = fs.readFileSync(actual);
    const ext = path.extname(actual).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2"
    };
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
  } catch (_) {
    json(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch (_) {
    json(res, 400, { error: "Invalid URL" });
    return;
  }
  if (url.pathname === "/health") {
    json(res, 200, { ok: true, service: "dalilna-directory-api", version: VERSION });
    return;
  }
  if (url.pathname === "/api/places/search") {
    const searchStartedAt = Date.now();
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" }, { "Allow": "GET, OPTIONS" });
      return;
    }
    if (!rateLimit(req)) {
      json(res, 429, { error: "عدد عمليات البحث كبير. انتظر قليلاً ثم حاول مجدداً." });
      return;
    }
    try {
      console.info(JSON.stringify({event:"places.search.start",place:cleanText(url.searchParams.get("place"),100),category:cleanText(url.searchParams.get("category"),30)}));
      const result = await searchPlaces({
        q: url.searchParams.get("q"),
        place: url.searchParams.get("place"),
        fallbackPlace: url.searchParams.get("fallbackPlace"),
        category: url.searchParams.get("category"),
        lat: url.searchParams.get("lat"),
        lon: url.searchParams.get("lon"),
        radius: url.searchParams.get("radius")
      });
      console.info(JSON.stringify({event:"places.search.complete",count:result.count,durationMs:Date.now()-searchStartedAt}));
      json(res, 200, result);
    } catch (error) {
      const status = Number(error.statusCode) || 503;
      console.warn(JSON.stringify({event:"places.search.error",status,durationMs:Date.now()-searchStartedAt,message:cleanText(error.message,160)}));
      json(res, status, { error: cleanText(error.message, 240) || "تعذّر البحث حالياً." });
    }
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    json(res, 404, { error: "API route not found" });
    return;
  }
  serveStatic(req, res, url.pathname);
});

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    process.stdout.write("Dalilna directory API listening on " + PORT + "\n");
  });
}

module.exports = { buildOverpassQuery, classifyCategory, normalizeElement, normalizeText, searchPlaces, server };
