"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { handleMarketplaceRequest } = require("./marketplace-api");
const { handleJobsRequest } = require("./jobs-api");
const geminiAssistantHandler = require("./api/assistant");

const PORT = Number(process.env.PORT || 10000);
const VERSION = require("./package.json").version;
const ALLOWED_ORIGINS = new Set([
  "https://dalilna-yemen.onrender.com",
  "https://dalilna-live.onrender.com",
  "https://dalilna-yemen.vercel.app",
  "https://dalilna-oavk.vercel.app",
  "https://dalilna-roan.vercel.app",
  "https://baraagpt6-droid.github.io",
  "https://dalilna-ftny.netlify.app",
  "https://appassets.androidplatform.net",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
]);
const CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;
const resultCache = new Map();
const commonsCache = new Map();
const geocodeCache = new Map();
const rateBuckets = new Map();
let lastGeocodeAt = 0;
let lastOverpassAt = 0;


const CATEGORY_MAPPING = require("./category-mapping.json");
const ALL_OSM_KEYS = [
  "shop","amenity","healthcare","tourism","office","craft","leisure",
  "public_transport","landuse","railway","building","emergency",
  "delivery","courier","service","product"
];
const ALL_FILTERS = [...new Set(ALL_OSM_KEYS.map(key => '[ "'+key+'" ]'.replace(/ /g,"")))];
const CATEGORY_ALIASES = {land:"real_estate",watches:"gold"};
function osmFilter(rule) {
  const key=String(rule.key||"").replace(/[^a-zA-Z0-9:_-]/g,"");
  const value=String(rule.value||"");
  if(!key)return "";
  if(value==="*")return '["'+key+'"]';
  if(!/^[a-zA-Z0-9:_-]+$/.test(value))return "";
  return '["'+key+'"="'+value+'"]';
}
const FILTERS = Object.fromEntries(Object.entries(CATEGORY_MAPPING.categories||{}).map(([category,definition])=>{
  const rules=(definition.osmTags||[]).map(osmFilter).filter(Boolean);
  return [category,rules.length?rules:(category==="parts"?[]:ALL_FILTERS)];
}));
FILTERS.all=ALL_FILTERS;
FILTERS.land=FILTERS.real_estate||ALL_FILTERS;
FILTERS.watches=FILTERS.gold||ALL_FILTERS;
// Spare-parts tags are classified in the vehicles section. Preserve older links.
FILTERS.parts=FILTERS.vehicles||[];

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
  const pathname = String(req.url || "").split("?")[0];
  if (pathname === "/api/assistant") {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    return;
  }
  // These endpoints return public map data only. Wildcard CORS avoids brittle
  // hostname allowlists for Render previews, PWA hosts and Android WebView.
  if (pathname === "/health" || pathname.startsWith("/api/places/") || pathname.startsWith("/api/geoapify/") || pathname.startsWith("/api/marketplace/") || pathname === "/api/jobs" || pathname.startsWith("/api/jobs/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", (pathname.startsWith("/api/marketplace/") || pathname.startsWith("/api/jobs/")) ? "GET, POST, OPTIONS" : "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "600");
    return;
  }
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

async function readAssistantRequestBody(req, maxBytes = 16 * 1024) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("request_too_large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
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

let localYemenIndexCache = null;
function loadLocalYemenIndex() {
  if (localYemenIndexCache) return localYemenIndexCache;
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const zlib = require("node:zlib");
    const file = path.join(__dirname, "regional-catalog", "search_index_light.json");
    const envelope = JSON.parse(fs.readFileSync(file, "utf8"));
    if (envelope.schemaVersion !== 2 || envelope.encoding !== "gzip+base64" || !envelope.data) return null;
    const payload = JSON.parse(zlib.gunzipSync(Buffer.from(envelope.data, "base64")).toString("utf8"));
    if (!Array.isArray(payload.i) || !Array.isArray(payload.c) || !Array.isArray(payload.g) || !Array.isArray(payload.d)) return null;
    localYemenIndexCache = payload;
    return payload;
  } catch (error) {
    console.warn(JSON.stringify({event:"places.local_catalog.unavailable",code:cleanText(error.code||error.name,60)}));
    return null;
  }
}

function normalizeLocalCatalogText(value) {
  return normalizeText(value).replace(/ة/g,"ه").replace(/ى/g,"ي")
    .split(/\\s+/).filter(Boolean)
    .map(token=>token.startsWith("ال")&&token.length>4?token.slice(2):token).join(" ");
}

function searchLocalYemenCatalog({query="",category="all",place="",bbox=null,lat=null,lon=null,radius=7000}={}) {
  const payload=loadLocalYemenIndex();
  if(!payload)return null;
  const wantedCategory=CATEGORY_ALIASES[category]||category||"all";
  const queryText=normalizeLocalCatalogText(query);
  const queryTokens=queryText.split(" ").filter(token=>token.length>1);
  const queryCategory=inferCategoryFromQuery(query);
  const categoryOnlyQuery=queryCategory&&queryCategory===(CATEGORY_ALIASES[wantedCategory]||wantedCategory);
  const areaParts=String(place||"").split(/[،,]/)
    .map(part=>{
      const original=String(part).trim();
      const scope=/^(?:محافظة|governorate)(?:\s|$)/iu.test(original)?"governorate":
        /^(?:مديرية|عزلة|district)(?:\s|$)/iu.test(original)?"district":"any";
      const value=normalizeLocalCatalogText(original.replace(/(?:محافظة|مديرية|عزلة|منطقة|مدينة|اليمن|yemen|governorate|district)/giu," "));
      return {scope,value};
    })
    .filter(part=>part.value);
  const hasCoords=Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&lat!==null&&lon!==null;
  const nearRadius=Math.min(15000,Math.max(500,Number(radius)||7000));
  const bounds=bbox&&["south","north","west","east"].every(key=>Number.isFinite(Number(bbox[key])))?bbox:null;
  const items=[];
  for(const row of payload.i) {
    if(!Array.isArray(row)||row.length<9)continue;
    const rowCategory=String(payload.c[row[2]]||"other");
    if(wantedCategory!=="all"&&rowCategory!==wantedCategory)continue;
    const governorate=String(payload.g[row[3]]||"");
    const districtEntry=payload.d[row[4]];
    const district=Array.isArray(districtEntry)?String(districtEntry[0]||""):String(districtEntry||"");
    const normalizedGov=normalizeLocalCatalogText(governorate);
    const normalizedDistrict=normalizeLocalCatalogText(district);
    if(areaParts.length&&!areaParts.every(part=>{
      if(part.scope==="governorate")return normalizedGov.includes(part.value);
      if(part.scope==="district")return normalizedDistrict.includes(part.value);
      return normalizedGov.includes(part.value)||normalizedDistrict.includes(part.value);
    }))continue;
    const itemLat=row[6]===null||row[6]===undefined?null:Number(row[6])/100000;
    const itemLon=row[7]===null||row[7]===undefined?null:Number(row[7])/100000;
    if(bounds) {
      if(!Number.isFinite(itemLat)||!Number.isFinite(itemLon)||itemLat<Number(bounds.south)||itemLat>Number(bounds.north)||itemLon<Number(bounds.west)||itemLon>Number(bounds.east))continue;
    } else if(hasCoords) {
      if(!Number.isFinite(itemLat)||!Number.isFinite(itemLon))continue;
      const dLat=(itemLat-Number(lat))*111000;
      const dLon=(itemLon-Number(lon))*111000*Math.cos(Number(lat)*Math.PI/180);
      if(Math.hypot(dLat,dLon)>nearRadius)continue;
    }
    const name=String(row[1]||"");
    const searchText=normalizeLocalCatalogText([name,governorate,district,row[8]||""].join(" "));
    if(queryTokens.length&&!categoryOnlyQuery&&!queryTokens.some(token=>searchText.includes(token)))continue;
    const address=[district,governorate,"اليمن"].filter(Boolean).join("، ");
    const validCoordinates=Number.isFinite(itemLat)&&Number.isFinite(itemLon);
    const mapsUrl=validCoordinates
      ?"https://www.openstreetmap.org/?mlat="+itemLat+"&mlon="+itemLon+"#map=18/"+itemLat+"/"+itemLon
      :"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([name,address].filter(Boolean).join(" "));
    items.push({
      id:"yemen-catalog-"+String(row[0]),
      name,
      category:rowCategory,
      categories:[rowCategory],
      address,
      governorate,
      district,
      phone:cleanText(row[5]||"",60),
      openingHours:cleanText(row[8]||"",120),
      lat:validCoordinates?itemLat:null,
      lon:validCoordinates?itemLon:null,
      mapsUrl,
      source:"فهرس اليمن الوطني المحلي",
      sourceUrl:"https://www.openstreetmap.org/copyright",
      verificationStatus:"not_field_verified_by_dalilna",
      localCatalogFallback:true
    });
    if(items.length>=80)break;
  }
  const result={
    category:wantedCategory,
    items,
    count:items.length,
    source:"فهرس اليمن الوطني المحلي (OSM + Overture)",
    place:cleanText(place||"اليمن",180),
    attribution:"OpenStreetMap contributors وOverture Maps",
    sourceUrl:"https://www.openstreetmap.org/copyright",
    localCatalogFallback:true,
    fetchedAt:new Date().toISOString(),
    cached:false,
    note:"هذه نتائج من الفهرس الوطني المحلي. أرقام التواصل وساعات العمل من السجل المصدر ولم يتم التحقق منها ميدانياً."
  };
  return result;
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


function createIntervalGate(intervalMs) {
  let nextAt = 0;
  let queue = Promise.resolve();
  return function waitForSlot(deadlineAt = Infinity, maxDelayMs = Infinity) {
    const reservation = queue.then(async () => {
      const delay = Math.max(0, nextAt - Date.now());
      if (delay > maxDelayMs) {
        const busy = new Error("مصدر الخريطة مشغول بطلب سابق؛ سيتم تجاوز المرآة الحالية.");
        busy.name = "SlotBusyError";
        busy.code = "OVERPASS_SLOT_BUSY";
        busy.statusCode = 503;
        throw busy;
      }
      if (Number.isFinite(deadlineAt) && Date.now() + delay >= deadlineAt) {
        const timeout = new Error("انتهت مهلة البحث قبل الاتصال بمصدر الخريطة.");
        timeout.name = "AbortError";
        timeout.statusCode = 503;
        throw timeout;
      }
      if (delay) await sleep(delay);
      nextAt = Date.now() + intervalMs;
    });
    queue = reservation.catch(() => {});
    return reservation;
  };
}
const waitForNominatimSlot = createIntervalGate(1100);
// Rate-limit each Overpass host independently. A busy primary must not consume
// the next mirror's start interval or the shared search deadline.
const overpassProviderSlots = new Map();
function waitForOverpassSlot(providerName,deadlineAt=Infinity){
  const key=String(providerName||"default");
  let gate=overpassProviderSlots.get(key);
  if(!gate){gate=createIntervalGate(1100);overpassProviderSlots.set(key,gate);}
  // Do not spend the shared map-search deadline waiting behind another
  // request to the same host. A busy mirror is skipped and the next is tried.
  return gate(deadlineAt,250);
}
const waitForCommonsSlot = createIntervalGate(1100);

function buildOverpassQuery(bbox, category) {
  const filters = FILTERS[category] || FILTERS.all;
  const box = [bbox.south, bbox.west, bbox.north, bbox.east].map(n => Number(n).toFixed(6)).join(",");
  const union = filters.map(filter => "nwr" + filter + "(" + box + ");").join("\n");
  return "[out:json][timeout:3][maxsize:134217728];\n(\n" + union + "\n);\nout center tags 80;";
}

function isCategoryOnlyYemenQuery(query,category){
  const definition=CATEGORY_MAPPING.categories?.[category];
  if(!definition)return false;
  const normalized=normalizeCategorySearch(query);
  if(!normalized)return false;
  const aliases=[definition.labelAr,definition.labelEn,...(definition.aliases||[]),...(CATEGORY_MAPPING.externalCategoryHints?.[category]||[])];
  const aliasTexts=aliases.map(normalizeCategorySearch).filter(Boolean);
  if(aliasTexts.includes(normalized))return true;
  const stop=new Set(["اقرب","قريب","قريبه","قريبة","near","nearest","the","in","at","في","من","اليمن","yemen","خدمات","محلات"]);
  const allowed=new Set(aliasTexts.flatMap(value=>value.split(/\s+/)));
  const tokens=normalized.split(/\s+/).filter(Boolean);
  return tokens.length>0&&tokens.every(token=>stop.has(token)||allowed.has(token));
}
function buildYemenOverpassQuery(query,category="all"){
  const selected=FILTERS[category]?category:(inferCategoryFromQuery(query)||"all");
  const categoryOnly=isCategoryOnlyYemenQuery(query,selected);
  let filters=[];
  if(categoryOnly&&selected!=="all"){
    filters=FILTERS[selected]||[];
  }else{
    const pattern=String(query||"").trim().replace(/[^\u0600-\u06FFa-zA-Z0-9\s_-]/g," ").replace(/\s+/g," ").trim();
    const qlValue=pattern.replace(/\\/g,"\\\\").replace(/"/g,'\\"');
    if(!qlValue)return "";
    filters=["name","name:ar","name:en","brand","operator"].map(key=>'["'+key+'"~"'+qlValue+'",i]');
  }
  if(!filters.length)return "";
  const union=filters.map(filter=>"nwr"+filter+"(area.yemen);").join("\n");
  return '[out:json][timeout:3][maxsize:134217728];\narea["ISO3166-1"="YE"][admin_level=2]->.yemen;\n(\n'+union+'\n);\nout center tags 80;';
}
function normalizeCategorySearch(value) {
  return normalizeText(value).replace(/ة/g,"ه").replace(/ى/g,"ي").split(/\s+/)
    .filter(Boolean).map(token=>token.startsWith("ال")&&token.length>4?token.slice(2):token).join(" ");
}
function inferCategoryFromQuery(query) {
  const text=normalizeCategorySearch(query);
  if(!text)return "";
  const queryTokens=new Set(text.split(" "));
  const ordered=CATEGORY_MAPPING.primaryCategoryOrder||Object.keys(CATEGORY_MAPPING.categories||{});
  for(const [category,definition] of ordered.map(key=>[key,CATEGORY_MAPPING.categories[key]]).filter(([,definition])=>definition)){
    const aliases=[definition.labelAr,definition.labelEn,...(definition.aliases||[])].filter(Boolean);
    for(const alias of aliases){
      const normalized=normalizeCategorySearch(alias);
      const tokens=normalized.split(" ").filter(Boolean);
      const matches=normalized&&(text===normalized||text.includes(normalized)||(text.length>=3&&normalized.includes(text))||tokens.every(token=>queryTokens.has(token)));
      if(matches){
        if(category==="real_estate")return "land";
        return category;
      }
    }
  }
  return "";
}
const GEOAPIFY_CATEGORY_MAP = {
  grocery: ["commercial.supermarket", "commercial.convenience", "commercial.marketplace"],
  food: ["catering.restaurant", "catering.fast_food", "catering.food_court"],
  cafe: ["catering.cafe"],
  telecom: ["commercial.elektronics"],
  elec: ["commercial.elektronics", "commercial.computer"],
  pharmacy: ["healthcare.pharmacy", "commercial.health_and_beauty.pharmacy"],
  health: ["healthcare.hospital", "healthcare.clinic_or_praxis", "healthcare.dentist"],
  edu: ["education.school", "education.college", "education.university", "childcare.kindergarten"],
  gov: ["office.government"],
  money: ["service.financial.bank", "service.financial.atm", "service.financial.bureau_de_change", "service.financial.money_transfer"],
  craft: ["commercial", "service"],
  transport: ["service.taxi", "public_transport"],
  mosque: ["religion.place_of_worship.islam"],
  hotel: ["accommodation.hotel", "accommodation.guest_house", "accommodation.hostel"],
  market: ["commercial.marketplace"],
  solar: ["commercial.energy"],
  parts: [],
  build: ["commercial.houseware_and_hardware.building_materials", "commercial.houseware_and_hardware.hardware_and_tools"],
  clothes: ["commercial.clothing"],
  home: ["commercial.furniture_and_interior", "commercial.houseware_and_hardware"],
  books: ["commercial.books", "commercial.stationery", "commercial.newsagent"],
  vehicles: ["commercial.vehicle"],
  watches: ["commercial.watches"],
  beauty: ["commercial.health_and_beauty", "service.beauty"],
  salon: ["service.beauty.hairdresser"],
  laundry: ["service.cleaning.laundry"],
  delivery: ["service.post", "service.post.office", "service.post.parcel_locker"],
  utility: ["service.vehicle.fuel"],
  gold: ["commercial.jewelry"],
  wedding: ["commercial.wedding", "catering"],
  farm: ["commercial.agrarian", "commercial.garden"]
};
const GEOAPIFY_ALL_CATEGORIES = [
  "commercial", "catering", "healthcare", "education", "childcare",
  "accommodation", "service", "office.government", "religion.place_of_worship",
  "public_transport", "activity.events_venue"
];
const geoapifyCache = new Map();
const geoapifyDetailsCache = new Map();
const waitForGeoapifySlot = createIntervalGate(220);

function geoapifyEnabled() {
  return Boolean(String(process.env.GEOAPIFY_API_KEY || "").trim());
}

function geoapifyRectFilter(bbox) {
  const west = Math.min(Number(bbox.west), Number(bbox.east));
  const east = Math.max(Number(bbox.west), Number(bbox.east));
  const south = Math.min(Number(bbox.south), Number(bbox.north));
  const north = Math.max(Number(bbox.south), Number(bbox.north));
  if (![west, east, south, north].every(Number.isFinite) || west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    throw new Error("Invalid geographic bounding box for Geoapify.");
  }
  // Geoapify rectangles require lon1,lat1,lon2,lat2 (west,south,east,north).
  return "rect:" + [west, south, east, north].map(value => Number(value.toFixed(6))).join(",");
}

function geoapifyCategoryLabel(category, properties = {}) {
  const labels = {
    grocery:"بقالات وتموينات",food:"مطاعم ومخابز",cafe:"كافيهات وبوفيهات",
    pharmacy:"صيدليات",health:"مراكز صحية",edu:"تعليم ومدارس",telecom:"جوالات واتصالات",elec:"إلكترونيات وكمبيوتر",
    gov:"جهات حكومية",money:"بنوك وصرافة",craft:"حرف وخدمات",
    transport:"مواصلات",mosque:"مساجد",hotel:"فنادق وسكن",
    market:"أسواق",solar:"طاقة شمسية وكهربائيات",parts:"قطع غيار",
    build:"مواد بناء",clothes:"ملابس",home:"أثاث ومستلزمات منزلية",
    books:"مكتبات وقرطاسية",vehicles:"معارض سيارات ومركبات",watches:"محلات ساعات",beauty:"تجميل وعناية",salon:"صالونات",
    laundry:"مغاسل",delivery:"بريد وتوصيل",utility:"وقود وخدمات",
    gold:"ذهب ومجوهرات",wedding:"قاعات مناسبات",farm:"زراعة وحدائق"
  };
  if (FILTERS[category] && category !== "all") return labels[category] || "خدمة";
  const cats = Array.isArray(properties.categories) ? properties.categories : [];
  const first = cats.find(value => typeof value === "string") || "";
  if (/supermarket|convenience|marketplace/.test(first)) return "بقالات وأسواق";
  if (/catering\.restaurant|fast_food/.test(first)) return "مطاعم";
  if (/catering\.cafe/.test(first)) return "كافيهات";
  if (/healthcare\.pharmacy/.test(first)) return "صيدليات";
  if (/healthcare/.test(first)) return "خدمات صحية";
  if (/education/.test(first)) return "تعليم";
  if (/office\.government/.test(first)) return "جهة حكومية";
  if (/financial/.test(first)) return "بنوك وصرافة";
  if (/religion/.test(first)) return "مسجد أو مكان عبادة";
  if (/accommodation/.test(first)) return "فنادق وسكن";
  return "خدمة";
}

function geoapifyMapsUrl(name, address, lat, lon) {
  const query = cleanText([name, address].filter(Boolean).join(" "), 260);
  if (query) return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(lat + "," + lon);
  return "";
}

async function geoapifyRequest(url, timeoutMs = 10000) {
  await waitForGeoapifySlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "DalilnaDirectory/"+VERSION+" (+https://dalilna-yemen.onrender.com)" }
    });
    if (!response.ok) {
      const error = new Error(response.status === 429
        ? "وصل البحث المجاني إلى حد الطلبات اليومي في Geoapify. جرّب غداً."
        : "تعذر جلب بيانات الأماكن من Geoapify.");
      error.statusCode = response.status === 429 ? 429 : 502;
      error.code = response.status === 429 ? "GEOAPIFY_QUOTA_REACHED" : "GEOAPIFY_UPSTREAM_ERROR";
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      const timeout = new Error("تأخر مصدر البحث المجاني. أعد المحاولة بعد قليل.");
      timeout.statusCode = 504;
      timeout.code = "GEOAPIFY_TIMEOUT";
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function geoapifyPlaceDetails(placeId, apiKey) {
  const id = cleanText(placeId, 180);
  if (!id) return {};
  const cached = readCache(geoapifyDetailsCache, id);
  if (cached) return cached;
  const url = new URL("https://api.geoapify.com/v2/place-details");
  url.search = new URLSearchParams({ id, lang: "ar", apiKey }).toString();
  try {
    const payload = await geoapifyRequest(url, 8000);
    const features = Array.isArray(payload.features) ? payload.features : [];
    const detail = features.find(feature => feature && feature.properties && feature.properties.feature_type === "details");
    const props = detail && detail.properties ? detail.properties : {};
    const contact = props.contact || {};
    const phone = cleanText(contact.phone || contact.phone_other && contact.phone_other[0] || "", 60);
    const result = {
      phone,
      website: cleanText(props.website || "", 240),
      openingHours: cleanText(props.opening_hours || "", 120),
      description: cleanText(props.description || "", 300)
    };
    touchCache(geoapifyDetailsCache, id, result, 24 * 60 * 60 * 1000);
    return result;
  } catch (error) {
    console.warn(JSON.stringify({ event: "geoapify.details.error", code: cleanText(error.code, 80) }));
    return {};
  }
}

async function searchGeoapifyPlaces(params) {
  const apiKey = String(process.env.GEOAPIFY_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("مصدر Geoapify المجاني غير مفعّل بعد. أضف مفتاحه المجاني إلى خادم دليلنا.");
    error.statusCode = 503;
    error.code = "GEOAPIFY_NOT_CONFIGURED";
    throw error;
  }
  const place = cleanText(params.place, 180);
  const fallbackPlace = cleanText(params.fallbackPlace, 180);
  const query = cleanText(params.q, 100);
  const requestedCategory = FILTERS[params.category] ? params.category : "all";
  const category = requestedCategory === "all" ? (inferCategoryFromQuery(query) || "all") : requestedCategory;
  const lat = Number(params.lat), lon = Number(params.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const radius = Math.min(15000, Math.max(1000, Number(params.radius) || 7000));
  const countrywideSearch=!hasCoordinates&&(!place||normalizeText(place)==="اليمن"||normalizeText(place)==="yemen");
  if(countrywideSearch&&!query){
    const error=new Error("أدخل اسم مكان أو نشاط للبحث في اليمن، أو اختر محافظة أو مديرية لتضييق النطاق.");
    error.statusCode=400;
    throw error;
  }
  if(countrywideSearch&&query)return searchYemenNominatim(query,category);

  const cacheKey = (hasCoordinates ? "near:" + lat.toFixed(3) + ":" + lon.toFixed(3) : normalizeText(place)) + "|" + category + "|" + normalizeText(query);
  const cached = readCache(geoapifyCache, cacheKey);
  if (cached) return { ...cached, cached: true, fetchedAt: new Date().toISOString() };

  let area = null, scopeFallback = false, usedPlace = place || "بالقرب من موقعك";
  if (hasCoordinates) {
    const latDelta = radius / 111000;
    const lonDelta = radius / (111000 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    area = { bbox: { south: lat - latDelta, north: lat + latDelta, west: lon - lonDelta, east: lon + lonDelta }, label: "بالقرب من موقعك" };
  } else {
    area = await geocodePlace(place,deadlineAt);
  }
  if (!area && fallbackPlace && normalizeText(fallbackPlace) !== normalizeText(place)) {
    area = await geocodePlace(fallbackPlace,deadlineAt);
    scopeFallback = true;
    usedPlace = fallbackPlace;
  }
  if (!area || !area.bbox) {
    const error = new Error("تعذر تحديد نطاق المنطقة. اختر محافظة أو مديرية أخرى.");
    error.statusCode = 404;
    throw error;
  }

  const categories = GEOAPIFY_CATEGORY_MAP[category] || GEOAPIFY_ALL_CATEGORIES;
  const south = area.bbox.south, north = area.bbox.north;
  const west = area.bbox.west, east = area.bbox.east;
  const latSteps = Math.max(1, Math.ceil((north - south) / 2.6));
  const lonSteps = Math.max(1, Math.ceil((east - west) / 2.6));
  const totalTiles = latSteps * lonSteps;
  if (totalTiles > 12) {
    const error = new Error("المنطقة واسعة جداً للبحث الكامل. اختر مديرية أو استخدم البحث حول موقعك.");
    error.statusCode = 400;
    error.code = "SEARCH_AREA_TOO_LARGE";
    throw error;
  }
  const uniqueFeatures = new Map();
  for (let row = 0; row < latSteps; row++) {
    for (let col = 0; col < lonSteps; col++) {
      const tile = {
        south: south + (north - south) * row / latSteps,
        north: south + (north - south) * (row + 1) / latSteps,
        west: west + (east - west) * col / lonSteps,
        east: west + (east - west) * (col + 1) / lonSteps
      };
      const searchUrl = new URL("https://api.geoapify.com/v2/places");
      const searchParams = {
        categories: categories.join(","),
        filter: geoapifyRectFilter(tile),
        limit: "20",
        lang: "ar",
        apiKey
      };
      if (query && category === "all") searchParams.name = query;
      searchUrl.search = new URLSearchParams(searchParams).toString();
      const payload = await geoapifyRequest(searchUrl, 12000);
      const rows = Array.isArray(payload.features) ? payload.features : [];
      for (const feature of rows) {
        const props = feature && feature.properties ? feature.properties : {};
        const placeId = cleanText(props.place_id || props.datasource && props.datasource.raw && props.datasource.raw.osm_id || "", 200);
        const latValue = Number(props.lat), lonValue = Number(props.lon);
        const key = placeId || (Number.isFinite(latValue) && Number.isFinite(lonValue) ? latValue.toFixed(5) + ":" + lonValue.toFixed(5) : "");
        if (key && !uniqueFeatures.has(key)) uniqueFeatures.set(key, feature);
      }
    }
  }
  const features = [...uniqueFeatures.values()];
  const baseItems = features.map(feature => {
    const props = feature && feature.properties ? feature.properties : {};
    const name = cleanText(props.name, 180);
    if (!name) return null;
    const pLat = Number(props.lat), pLon = Number(props.lon);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return null;
    const address = cleanText(props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join("، "), 240);
    const itemId = cleanText(props.place_id || props.datasource && props.datasource.raw && props.datasource.raw.osm_id || "", 200);
    return {
      id: itemId || "geoapify-" + pLat.toFixed(5) + "-" + pLon.toFixed(5),
      placeId: itemId,
      name,
      category: geoapifyCategoryLabel(category, props),
      address,
      phone: "",
      website: "",
      openingHours: "",
      description: "",
      lat: pLat,
      lon: pLon,
      mapsUrl: geoapifyMapsUrl(name, address, pLat, pLon),
      sourceUrl: "https://www.openstreetmap.org/?mlat=" + pLat + "&mlon=" + pLon + "#map=18/" + pLat + "/" + pLon,
      source: "Geoapify"
    };
  }).filter(Boolean);
  const items = [];
  for (const item of baseItems) {
    if (items.length < 8) {
      const details = item.placeId ? await geoapifyPlaceDetails(item.placeId, apiKey) : {};
      items.push({ ...item, ...details });
    } else {
      items.push(item);
    }
  }

  const result = {
    source: "Geoapify",
    category,
    items,
    count: items.length,
    tilesQueried: totalTiles,
    truncated: features.length >= totalTiles * 20,
    place: usedPlace,
    scopeFallback,
    attribution: "Powered by Geoapify · © OpenStreetMap contributors",
    attributionUrl: "https://www.geoapify.com/",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    cached: false,
    fetchedAt: new Date().toISOString(),
    note: "الأرقام والمواقع تظهر عند توفرها في بيانات OpenStreetMap. قد لا يكون لكل محل رقم هاتف مسجل."
  };
  // Empty upstream results are never cached: a temporary zero must not hide fallback results or later updates.
  if (items.length) touchCache(geoapifyCache, cacheKey, result, 10 * 60 * 1000);
  return result;
}

function categoryRuleMatches(tags, rule) {
  const actual=String(tags&&tags[rule.key]||"").trim().toLowerCase();
  const expected=String(rule.value||"").trim().toLowerCase();
  if(!actual||!(expected==="*"||actual===expected))return false;
  if(rule.when){
    const actualWhen=String(tags&&tags[rule.when.key]||"").trim().toLowerCase();
    const expectedWhen=String(rule.when.value||"").trim().toLowerCase();
    if(actualWhen!==expectedWhen)return false;
  }
  return true;
}
function categoriesForTags(tags) {
  const source=tags&&typeof tags==="object"?tags:{};
  if(String(source.amenity||"").trim().toLowerCase()==="bench")return [];
  const definitions=CATEGORY_MAPPING.categories||{},strictMatches=new Set();
  for(const rule of CATEGORY_MAPPING.strictPrimaryRules||[]){
    if(definitions[rule.category]&&categoryRuleMatches(source,rule))strictMatches.add(rule.category);
  }
  const order=CATEGORY_MAPPING.primaryCategoryOrder||Object.keys(definitions);
  const rank=new Map(order.map((category,index)=>[category,index]));
  if(strictMatches.size)return [...strictMatches].sort((a,b)=>(rank.get(a)??order.length)-(rank.get(b)??order.length)).slice(0,1);
  const matched=[];
  const external=Array.isArray(source.__catalog_categories)?source.__catalog_categories:
    (typeof source.__catalog_categories==="string"?[source.__catalog_categories]:[]);
  for(const category of external)if(definitions[category]&&!matched.includes(category))matched.push(category);
  for(const [category,definition] of Object.entries(definitions)){
    if((definition.osmTags||[]).some(rule=>categoryRuleMatches(source,rule))&&!matched.includes(category))matched.push(category);
  }
  for(const rule of CATEGORY_MAPPING.multiCategoryRules||[]){
    if(!categoryRuleMatches(source,rule))continue;
    for(const category of rule.categories||[])if(definitions[category]&&!matched.includes(category))matched.push(category);
  }
  const fallbackKeys=["shop","amenity","office","healthcare","tourism","craft","leisure","public_transport","railway","emergency","delivery","courier","service","government","building","landuse","highway","product"];
  if(!matched.length&&fallbackKeys.some(key=>String(source[key]||"").trim())&&definitions.other)matched.push("other");
  return matched.sort((a,b)=>(rank.get(a)??order.length)-(rank.get(b)??order.length)).slice(0,1);
}
function classifyCategory(tags) { return categoriesForTags(tags)[0]||"other"; }

function normalizeElement(element, placeLabel) {
  const tags = element.tags || {};
  const name = cleanText(tags["name:ar"] || tags.name || tags.brand || tags.operator, 140);
  const categories=categoriesForTags(tags);
  if (!name || !categories.length) return null;
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
  return {
    id: "osm-" + element.type + "-" + element.id,
    name,
    category: categories[0],
    address: address || placeLabel,
    phone,
    website,
    openingHours: cleanText(tags.opening_hours || "", 100),
    lat,
    lon,
    sourceUrl: "https://www.openstreetmap.org/" + element.type + "/" + element.id,
    description: cleanText(tags.description || tags.note || "", 500),
    cuisine: cleanText(tags.cuisine || "", 120),
    brand: cleanText(tags.brand || "", 120),
    operator: cleanText(tags.operator || "", 120),
    email: cleanText(tags["contact:email"] || tags.email || "", 160),
    mapsUrl: "https://www.openstreetmap.org/?mlat=" + lat + "&mlon=" + lon + "#map=18/" + lat + "/" + lon
  };
}

async function geocodePhotonFallback(candidates,key,deadlineAt=Date.now()+2600){
 for(const candidate of candidates){
  const remaining=deadlineAt-Date.now();
  if(remaining<=120)break;
  const url=new URL("https://photon.komoot.io/api/");
  url.search=new URLSearchParams({q:candidate,lang:"ar",limit:"10"}).toString();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(850,remaining));
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/geo+json","User-Agent":"DalilnaDirectory/"+VERSION+" (+https://dalilna-live.onrender.com)"}});
   if(!response.ok){
    console.warn(JSON.stringify({event:"places.geocode.photon.retry",status:response.status}));
    continue;
   }
   const data=await response.json();
   const features=Array.isArray(data.features)?data.features:[];
   for(const feature of features){
    const properties=feature&&feature.properties||{},country=String(properties.countrycode||"").toLowerCase();
    if(country&&country!=="ye")continue;
    const extent=Array.isArray(properties.extent)?properties.extent.map(Number):[];
    if(extent.length!==4||!extent.every(Number.isFinite))continue;
    const bbox={west:extent[0],south:extent[1],east:extent[2],north:extent[3]};
    if(bbox.north<=bbox.south||bbox.east<=bbox.west)continue;
    const spanLat=bbox.north-bbox.south,spanLon=bbox.east-bbox.west;
    if(spanLat>9||spanLon>9||spanLat*spanLon>42)continue;
    const label=[properties.name,properties.city,properties.state,properties.country].filter(Boolean).join("، ");
    const area={bbox,label:cleanText(label||candidate,220),geocoder:"Photon"};
    console.info(JSON.stringify({event:"places.geocode.success",provider:"Photon",place:cleanText(candidate,100)}));
    return touchCache(geocodeCache,key,area,6*60*60*1000);
   }
  }catch(error){
   console.warn(JSON.stringify({event:"places.geocode.photon.error",code:error&&error.name==="AbortError"?"TIMEOUT":"UPSTREAM_ERROR"}));
  }finally{clearTimeout(timer);}
 }
 return null;
}
async function geocodePlace(place,deadlineAt=Date.now()+2700) {
  const key=normalizeText(place);
  const cached=readCache(geocodeCache,key);
  if(cached)return cached;
  const cleanedPlace=cleanText(place.replace(/(?:^|،\s*)(?:محافظة|مديرية|عزلة)\s*/gu," ").replace(/،\s*اليمن$/g,"").replace(/\s+/g," "),180);
  const candidates=[...new Set([place,cleanedPlace+"، اليمن",
    /أمانة\s*العاصمة/u.test(place)?"Amanat Al Asimah, Yemen":"",
    /صنعاء/u.test(place)?"Sanaa, Yemen":""
  ].filter(Boolean))];
  let lastError=null;
  for(const candidate of candidates){
    try{await waitForNominatimSlot(deadlineAt,250);}catch(error){lastError=error;break;}
    const remaining=deadlineAt-Date.now();
    if(remaining<=120)break;
    lastGeocodeAt=Date.now();
    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.search=new URLSearchParams({q:candidate,format:"jsonv2",addressdetails:"1",limit:"5",countrycodes:"ye","accept-language":"ar,en"}).toString();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(1250,remaining));
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json","User-Agent":"DalilnaDirectory/"+VERSION+" (+https://dalilna-live.onrender.com)","Referer":"https://dalilna-live.onrender.com/"}});
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
        if(spanLat>9||spanLon>9||spanLat*spanLon>42){const error=new Error("النطاق واسع جداً. اختر مديرية أو استخدم البحث حول موقعك.");error.statusCode=400;throw error;}
        return touchCache(geocodeCache,key,{bbox,label:cleanText(row.display_name||candidate,220),osmType:row.osm_type||"",osmId:row.osm_id||null},12*60*60*1000);
      }
    }catch(error){
      if(error.statusCode)throw error;
      lastError=error.name==="AbortError"?new Error("تأخر مصدر تحديد المنطقة في الرد."):error;
    }finally{clearTimeout(timer);}
  }
  if(lastError)console.warn(JSON.stringify({event:"places.geocode.nominatim.unavailable",code:lastError.name==="AbortError"?"TIMEOUT":"NO_RESULT"}));
  const photonArea=await geocodePhotonFallback(candidates,key,deadlineAt);
  if(photonArea)return photonArea;
  if(lastError)throw lastError;
  return null;
}
async function fetchOverpass(bbox,category,label,deadlineAt=Date.now()+2700){
  const query=buildOverpassQuery(bbox,category);
  const endpoints=[
    {name:"FOSSGIS",url:"https://overpass-api.de/api/interpreter",timeoutMs:3000},
    {name:"Private.coffee",url:"https://overpass.private.coffee/api/interpreter",timeoutMs:3000},
    {name:"VK Maps",url:"https://maps.mail.ru/osm/tools/overpass/api/interpreter",timeoutMs:3000}
  ];
  let lastError=null;
  let hadValidEmpty=false;
  for(let providerIndex=0;providerIndex<endpoints.length;providerIndex++){
    const provider=endpoints[providerIndex];
    try{await waitForOverpassSlot(provider.name,deadlineAt);}catch(error){
      lastError=error;
      if(error.code==="OVERPASS_SLOT_BUSY"){
        console.info(JSON.stringify({event:"places.overpass.skip_busy_slot",provider:provider.name,remainingMs:Math.max(0,deadlineAt-Date.now())}));
        continue;
      }
      break;
    }
    const remaining=deadlineAt-Date.now();
    const attemptTimeoutMs=overpassAttemptTimeout(remaining,providerIndex,endpoints.length);
    if(attemptTimeoutMs<=120)break;
    lastOverpassAt=Date.now();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(provider.timeoutMs,attemptTimeoutMs)),startedAt=Date.now();
    try{
      const response=await fetch(provider.url,{
        method:"POST",
        signal:controller.signal,
        headers:{
          "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8",
          "Accept":"application/json",
          "User-Agent":"DalilnaDirectory/"+VERSION+" (+https://dalilna-live.onrender.com)"
        },
        body:new URLSearchParams({data:query})
      });
      if([429,503,504].includes(response.status)){
        lastError=new Error("مصدر بيانات الأماكن مشغول حالياً.");
        if(response.status!==503)console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,status:response.status,durationMs:Date.now()-startedAt}));
        continue;
      }
      if(!response.ok){
        lastError=new Error("تعذّر جلب بيانات الأماكن من المصدر المفتوح.");
        if(response.status!==503)console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,status:response.status,durationMs:Date.now()-startedAt}));
        continue;
      }
      const body=await response.json();
      if(body && body.remark){
        lastError=new Error("أعاد مصدر الخريطة نتيجة غير مكتملة: "+cleanText(body.remark,140));
        console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,status:200,remark:cleanText(body.remark,140),durationMs:Date.now()-startedAt}));
        continue;
      }
      if(!body || !Array.isArray(body.elements)){
        lastError=new Error("استجابة مصدر الخريطة غير صالحة.");
        console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,status:200,message:lastError.message,durationMs:Date.now()-startedAt}));
        continue;
      }
      const elements=body.elements,items=elements.map(item=>normalizeElement(item,label)).filter(Boolean),seen=new Set();
      const unique=items.filter(item=>{const key=normalizeText(item.name)+"|"+item.lat.toFixed(4)+"|"+item.lon.toFixed(4);if(seen.has(key))return false;seen.add(key);return true;});
      if(!unique.length){
        hadValidEmpty=true;
        console.info(JSON.stringify({event:"places.overpass.empty",provider:provider.name,category,durationMs:Date.now()-startedAt}));
        continue;
      }
      console.info(JSON.stringify({event:"places.overpass.success",provider:provider.name,category,count:unique.length,durationMs:Date.now()-startedAt}));
      return unique.slice(0,80);
    }catch(error){
      lastError=error.name==="AbortError"?new Error("انتهت مهلة مصدر الخريطة."):error;
      console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,message:cleanText(lastError.message,140),durationMs:Date.now()-startedAt}));
    }finally{clearTimeout(timer);}
  }
  if(hadValidEmpty)return [];
  throw lastError||new Error("مصادر بيانات الأماكن غير متاحة حالياً.");
}

async function searchCommonsPhotos(query, place) {
  const terms=cleanText([query,place].filter(Boolean).join(" "),180);
  if(!terms){const error=new Error("اكتب اسم المكان للبحث عن الصور.");error.statusCode=400;throw error;}
  const cacheKey=normalizeText(terms);
  const cached=readCache(commonsCache,cacheKey);
  if(cached)return {...cached,cached:true};
  const url=new URL("https://commons.wikimedia.org/w/api.php");
  url.search=new URLSearchParams({
    action:"query",format:"json",generator:"search",gsrsearch:terms,
    gsrnamespace:"6",gsrlimit:"8",prop:"imageinfo",
    iiprop:"url|extmetadata",iiurlwidth:"640"
  }).toString();
  await waitForCommonsSlot();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{
      "Accept":"application/json",
      "User-Agent":"DalilnaDirectory/"+VERSION+" (https://dalilna-live.onrender.com; contact: dalilna project)"
    }});
    if(response.status===429){const error=new Error("مكتبة الصور مزدحمة. حاول لاحقاً.");error.statusCode=429;throw error;}
    if(!response.ok)throw new Error("تعذر الاتصال بمكتبة Wikimedia Commons.");
    const payload=await response.json();
    const pages=payload&&payload.query&&payload.query.pages?Object.values(payload.query.pages):[];
    const items=pages.map(page=>{
      const info=Array.isArray(page.imageinfo)?page.imageinfo[0]:null,meta=info&&info.extmetadata||{};
      if(!info||!info.thumburl||!info.descriptionurl)return null;
      try { if(new URL(info.thumburl).hostname!=="upload.wikimedia.org" || new URL(info.descriptionurl).hostname!=="commons.wikimedia.org") return null; } catch (_) { return null; }
      return {
        title:cleanText(String(page.title||"").replace(/^File:/,""),180),
        imageUrl:info.thumburl,
        sourceUrl:info.descriptionurl,
        author:cleanText(meta.Artist&&meta.Artist.value?String(meta.Artist.value).replace(/<[^>]*>/g," "):"",180),
        license:cleanText(meta.LicenseShortName&&meta.LicenseShortName.value?meta.LicenseShortName.value:"راجع صفحة الملف",80)
      };
    }).filter(Boolean).slice(0,8);
    const result={source:"Wikimedia Commons",items,count:items.length,note:"قد لا تكون الصور للمكان نفسه. تحقق من صفحة الملف والترخيص قبل إعادة الاستخدام.",cached:false};
    touchCache(commonsCache,cacheKey,result,60*60*1000);
    return result;
  }catch(error){
    if(error.name==="AbortError")throw new Error("انتهت مهلة البحث عن الصور.");
    throw error;
  }finally{clearTimeout(timer);}
}

async function searchYemenNominatim(query, category="all",deadlineAt=Date.now()+2700) {
  const normalizedQuery=normalizeText(query);
  const cacheKey="nominatim:yemen:"+normalizedQuery+"|"+category;
  const cached=readCache(resultCache,cacheKey);
  if(cached)return {...cached,cached:true,fetchedAt:new Date().toISOString()};
  try{await waitForNominatimSlot(deadlineAt);}catch(error){error.statusCode=503;throw error;}
  const remaining=deadlineAt-Date.now();
  if(remaining<=120){const error=new Error("انتهت مهلة البحث الحي.");error.statusCode=503;throw error;}
  lastGeocodeAt=Date.now();
  const url=new URL("https://nominatim.openstreetmap.org/search");
  url.search=new URLSearchParams({
    q:query,format:"jsonv2",addressdetails:"1",extratags:"1",namedetails:"1",
    limit:"20",countrycodes:"ye","accept-language":"ar,en"
  }).toString();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(1900,remaining));
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{
      "Accept":"application/json",
      "User-Agent":"DalilnaDirectory/"+VERSION+" (+https://dalilna-live.onrender.com)",
      "Referer":"https://dalilna-live.onrender.com/"
    }});
    if(response.status===429){const error=new Error("مصدر البحث المفتوح مزدحم. حاول مرة أخرى بعد قليل.");error.statusCode=503;throw error;}
    if(!response.ok){const error=new Error("تعذر البحث بالاسم في OpenStreetMap حالياً.");error.statusCode=503;throw error;}
    const payload=await response.json();
    const rows=Array.isArray(payload)?payload:[];
    const items=rows.filter(row=>{
      const code=String(row.address?.country_code||"").toLowerCase();
      const lat=Number(row.lat),lon=Number(row.lon);
      return (!code||code==="ye")&&Number.isFinite(lat)&&Number.isFinite(lon)
        &&lat>=11&&lat<=20.5&&lon>=41&&lon<=55.5;
    }).map(row=>{
      const tags=row.extratags&&typeof row.extratags==="object"?row.extratags:{};
      const names=row.namedetails&&typeof row.namedetails==="object"?row.namedetails:{};
      const name=cleanText(row.name||names.name||row.display_name?.split(",")[0]||"",180);
      if(!name)return null;
      const categoryFromTags=classifyCategory({[row.category||row.class||""]:row.type||""});
      if(category&&category!=="all"&&categoryFromTags!==category)return null;
      const categoryValue=categoryFromTags||"other";
      const lat=Number(row.lat),lon=Number(row.lon),type=String(row.osm_type||"").toLowerCase(),id=String(row.osm_id||"");
      const phone=cleanText(tags.phone||tags["contact:phone"]||tags.mobile||"",60);
      const website=cleanText(tags.website||tags["contact:website"]||"",300);
      const openingHours=cleanText(tags.opening_hours||"",100);
      const mapsUrl="https://www.openstreetmap.org/?mlat="+lat+"&mlon="+lon+"#map=18/"+lat+"/"+lon;
      return {
        id:type&&id?"osm-"+type+"-"+id:"nominatim-"+lat.toFixed(6)+"-"+lon.toFixed(6),
        name,nameEn:cleanText(names["name:en"]||"",160),category:categoryValue,categories:[categoryValue],
        address:cleanText(row.display_name||"",260),phone,website,openingHours,lat,lon,
        governorate:cleanText(row.address?.state||row.address?.province||"",100),
        district:cleanText(row.address?.county||row.address?.district||row.address?.city||"",100),
        source:"OpenStreetMap (Nominatim)",sourceUrl:type&&id?"https://www.openstreetmap.org/"+type+"/"+id:"https://www.openstreetmap.org/copyright",
        mapsUrl,assignmentQuality:"live-nominatim"
      };
    }).filter(Boolean);
    const result={
      category,items,count:items.length,source:"OpenStreetMap Nominatim",
      attribution:"© OpenStreetMap contributors",
      sourceUrl:"https://www.openstreetmap.org/copyright",
      place:"اليمن",fetchedAt:new Date().toISOString(),cached:false,
      paidProvidersDisabled:true,
      note:"نتائج بحث اسمية مباشرة داخل اليمن. قد لا تتضمن الهاتف أو ساعات العمل إذا لم ينشرها المصدر."
    };
    if(items.length)touchCache(resultCache,cacheKey,result,5*60*1000);
    return result;
  }catch(error){
    if(error.name==="AbortError"){const timeout=new Error("تأخر بحث OpenStreetMap في الرد.");timeout.statusCode=503;throw timeout;}
    throw error;
  }finally{clearTimeout(timer);}
}

function overpassAttemptTimeout(remainingMs,providerIndex,providerCount){
  const remaining=Math.max(0,Number(remainingMs)||0);
  const index=Math.max(0,Math.floor(Number(providerIndex)||0));
  const count=Math.max(index+1,Math.floor(Number(providerCount)||1));
  if(!remaining)return 0;
  // Give the current source a fair share of the remaining window. A quick
  // 429/503 then leaves most of the budget for the next independent mirror.
  const providersLeft=Math.max(1,count-index);
  const fairShare=Math.floor(remaining/providersLeft);
  return Math.min(3000,remaining,Math.max(Math.min(450,remaining),fairShare));
}

async function searchYemenOverpass(query,category="all",deadlineAt=Date.now()+2700){
  const normalized=normalizeCategorySearch(query);
  const selected=FILTERS[category]?category:(inferCategoryFromQuery(query)||"all");
  const cacheKey="overpass:yemen:"+normalized+"|"+selected;
  const cached=readCache(resultCache,cacheKey);
  if(cached)return {...cached,cached:true,fetchedAt:new Date().toISOString()};
  const ql=buildYemenOverpassQuery(query,selected);
  if(!ql)return {items:[],count:0,category:selected,source:"OpenStreetMap Overpass",cached:false};
  const endpoints=[
    {name:"FOSSGIS",url:"https://overpass-api.de/api/interpreter",timeoutMs:3000},
    {name:"Private.coffee",url:"https://overpass.private.coffee/api/interpreter",timeoutMs:3000},
    {name:"VK Maps",url:"https://maps.mail.ru/osm/tools/overpass/api/interpreter",timeoutMs:3000}
  ];
  let lastError=null,hadValidEmpty=false;
  for(let providerIndex=0;providerIndex<endpoints.length;providerIndex++){
    const provider=endpoints[providerIndex];
    try{await waitForOverpassSlot(provider.name,deadlineAt);}catch(error){
      lastError=error;
      if(error.code==="OVERPASS_SLOT_BUSY"){
        console.info(JSON.stringify({event:"places.overpass.skip_busy_slot",provider:provider.name,remainingMs:Math.max(0,deadlineAt-Date.now())}));
        continue;
      }
      break;
    }
    const remaining=deadlineAt-Date.now();
    const attemptTimeoutMs=overpassAttemptTimeout(remaining,providerIndex,endpoints.length);
    if(attemptTimeoutMs<=120)break;
    lastOverpassAt=Date.now();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(provider.timeoutMs,attemptTimeoutMs)),startedAt=Date.now();
    try{
      const response=await fetch(provider.url,{method:"POST",signal:controller.signal,
        headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","Accept":"application/json",
          "User-Agent":"DalilnaDirectory/"+VERSION+" (+https://dalilna-live.onrender.com)"},
        body:new URLSearchParams({data:ql})});
      if([429,503,504].includes(response.status)){lastError=new Error("مصدر بيانات الأماكن مشغول حالياً.");continue;}
      if(!response.ok){lastError=new Error("تعذّر جلب نتائج البحث الوطني من Overpass.");continue;}
      const body=await response.json();
      if(!body||!Array.isArray(body.elements)||body.remark){lastError=new Error("استجابة بحث اليمن من Overpass غير مكتملة.");continue;}
      const categoryOnly=isCategoryOnlyYemenQuery(query,selected);
      const tokens=normalized.split(/\s+/).filter(token=>token.length>1);
      const seen=new Set();
      const items=body.elements.map(element=>normalizeElement(element,"اليمن"))
        .filter(item=>item&&(selected==="all"||item.category===selected))
        .filter(item=>categoryOnly||tokens.every(token=>normalizeCategorySearch([item.name,item.nameEn,item.address,item.brand].join(" ")).includes(token)))
        .filter(item=>{const key=String(item.id||"")+"|"+normalizeText(item.name)+"|"+Number(item.lat).toFixed(4)+"|"+Number(item.lon).toFixed(4);if(seen.has(key))return false;seen.add(key);return true;})
        .slice(0,80);
      if(!items.length){hadValidEmpty=true;continue;}
      const result={items,count:items.length,category:selected,source:"OpenStreetMap Overpass",
        attribution:"© OpenStreetMap contributors",sourceUrl:"https://www.openstreetmap.org/copyright",
        place:"اليمن",fetchedAt:new Date().toISOString(),cached:false,
        note:"نتائج البحث الحي داخل حدود اليمن. قد لا تتضمن بيانات المصدر أرقام الهاتف."};
      touchCache(resultCache,cacheKey,result,3*60*1000);
      console.info(JSON.stringify({event:"places.overpass.yemen.success",provider:provider.name,count:items.length,durationMs:Date.now()-startedAt}));
      return result;
    }catch(error){lastError=error.name==="AbortError"?new Error("انتهت مهلة بحث Overpass الوطني."):error;}
    finally{clearTimeout(timer);}
  }
  if(hadValidEmpty)return {items:[],count:0,category:selected,source:"OpenStreetMap Overpass",cached:false};
  throw lastError||new Error("مصادر بحث اليمن غير متاحة حالياً.");
}

async function searchPlaces(params) {
  const startedAt=Date.now();
  // Reserve a bounded geocoding window and keep the remaining time for all
  // Overpass mirrors. Geocoding must never reset or silently consume the map deadline.
  const deadlineAt=startedAt+5500;
  const geocodeDeadlineAt=Math.min(deadlineAt-3200,startedAt+2000);
  const place = cleanText(params.place, 180);
  const fallbackPlace = cleanText(params.fallbackPlace, 180);
  const query = cleanText(params.q, 100);
  const requestedCategory = FILTERS[params.category] ? params.category : "all";
  const category = requestedCategory === "all"
    ? (inferCategoryFromQuery(query) || "all")
    : requestedCategory;
  const hasLat = params.lat !== null && params.lat !== undefined && String(params.lat).trim() !== "";
  const hasLon = params.lon !== null && params.lon !== undefined && String(params.lon).trim() !== "";
  const lat = hasLat ? Number(params.lat) : NaN;
  const lon = hasLon ? Number(params.lon) : NaN;
  const hasCoordinates = hasLat && hasLon && Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= 11 && lat <= 20.5 && lon >= 41 && lon <= 55.5;
  const radius = Math.min(15000, Math.max(1000, Number(params.radius) || 7000));
  const countrywideSearch = !hasCoordinates && (!place || normalizeText(place) === "اليمن" || normalizeText(place) === "yemen");
  if (countrywideSearch && query) {
    const outcomes=await Promise.allSettled([
      searchYemenNominatim(query,category,deadlineAt),
      searchYemenOverpass(query,category,deadlineAt)
    ]);
    const nominal=outcomes[0].status==="fulfilled"?outcomes[0].value:{items:[],count:0,category,source:"OpenStreetMap Nominatim",place:"اليمن",cached:false};
    const overpass=outcomes[1].status==="fulfilled"?outcomes[1].value:{items:[],count:0,category,source:"OpenStreetMap Overpass",cached:false};
    const merged=[...(Array.isArray(nominal.items)?nominal.items:[])],seen=new Set();
    const signature=item=>String(item.id||"")+"|"+normalizeText(item.name)+"|"+Number(item.lat).toFixed(4)+"|"+Number(item.lon).toFixed(4);
    for(const item of merged)seen.add(signature(item));
    for(const item of Array.isArray(overpass.items)?overpass.items:[]){
      const key=signature(item);
      if(!seen.has(key)){seen.add(key);merged.push(item);}
    }
    const items=merged.slice(0,80);
    const result={
      ...nominal,items,count:items.length,category,place:"اليمن",
      source:"OpenStreetMap Nominatim + Overpass",
      liveFallbackCount:Array.isArray(overpass.items)?overpass.items.length:0,
      fetchedAt:new Date().toISOString(),cached:false,
      note:"نتائج البحث الحي داخل حدود اليمن. عند تعذر المصدر الخارجي يستمر البحث المحلي دون انتظار."
    };
    if(items.length)touchCache(resultCache,"yemen-hybrid:"+normalizeText(query)+"|"+category,result,2*60*1000);
    return result;
  }
  if ((!place || normalizeText(place) === "اليمن" || normalizeText(place) === "yemen") && !hasCoordinates && !query) {
    const error = new Error("أدخل اسم مكان أو نشاط للبحث في اليمن، أو اختر محافظة أو مديرية لتضييق النطاق.");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = (hasCoordinates ? "near:" + lat.toFixed(3) + ":" + lon.toFixed(3) : normalizeText(place)) + "|" + category;
  {
    const cached = readCache(resultCache, cacheKey);
    if (cached) {
      const copy = { ...cached, fetchedAt: new Date().toISOString(), cached: true };
      return filterByQuery(copy, query, category);
    }
  }

  let area = null;
  let scopeFallback = false;
  let usedPlace = place || "بالقرب من موقعك";
  let geocodeError = null;
  if (hasCoordinates) {
    const latDelta = radius / 111000;
    const lonDelta = radius / (111000 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    area = { bbox: { south: lat - latDelta, north: lat + latDelta, west: lon - lonDelta, east: lon + lonDelta }, label: "بالقرب من موقعك" };
  } else {
    try { area = await geocodePlace(place,geocodeDeadlineAt); }
    catch(error) { geocodeError = error; }
  }
  if (!area && fallbackPlace && normalizeText(fallbackPlace) !== normalizeText(place)) {
    try { area = await geocodePlace(fallbackPlace,geocodeDeadlineAt); }
    catch(error) { if(!geocodeError) geocodeError = error; }
    scopeFallback = true;
    usedPlace = fallbackPlace;
  }
  if (!area || !area.bbox) {
    const local=searchLocalYemenCatalog({query,category,place:usedPlace,lat:hasCoordinates?lat:null,lon:hasCoordinates?lon:null,radius});
    if(local&&local.count){
      console.info(JSON.stringify({event:"places.local_catalog.fallback",count:local.count,category,reason:geocodeError?"geocoder_unavailable":"area_unavailable"}));
      return local;
    }
    if(geocodeError) throw geocodeError;
    const error = new Error("تعذر تحديد نطاق المنطقة من مصادر الخرائط. اختر محافظة أو افتح البحث في OpenStreetMap.");
    error.statusCode = 404;
    throw error;
  }
  const cachedOsm = readCache(resultCache, cacheKey);
  if (cachedOsm) {
    const copy = {...cachedOsm,fetchedAt:new Date().toISOString(),cached:true};
    return filterByQuery(copy,query,category);
  }
  let items;
  try {
    items = await fetchOverpass(area.bbox, category, area.label || usedPlace,deadlineAt);
  } catch(error) {
    const local=searchLocalYemenCatalog({query,category,place:usedPlace,bbox:area.bbox,lat:hasCoordinates?lat:null,lon:hasCoordinates?lon:null,radius});
    if(local&&local.count){
      console.info(JSON.stringify({event:"places.local_catalog.fallback",count:local.count,category,reason:"overpass_unavailable",upstreamStatus:Number(error.statusCode)||503}));
      const localKey="local-catalog:"+cacheKey;
      touchCache(resultCache,localKey,local,3*60*1000);
      return local;
    }
    throw error;
  }
  const result = {
    category,items,count:items.length,source:"OpenStreetMap",
    attribution:"© OpenStreetMap contributors",
    sourceUrl:"https://www.openstreetmap.org/copyright",
    place:usedPlace,geocodedPlace:area.label,scopeFallback,
    fetchedAt:new Date().toISOString(),cached:false,
    paidProvidersDisabled:true,
    note:"قد تكون بيانات الخريطة غير مكتملة أو قديمة. تحقق من رقم التواصل وساعات العمل قبل الزيارة."
  };
  // Do not cache empty map responses. A mirror may be temporarily incomplete;
  // the next user retry should be able to query the other sources again.
  if(items.length)touchCache(resultCache,cacheKey,result);
  return filterByQuery(result,query,category);
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
      ".woff2": "font/woff2",
      ".txt": "text/plain; charset=utf-8"
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
  if (url.pathname === "/api/assistant/status") {
    if (req.method !== "GET") {
      json(res, 405, { error: "method_not_allowed" }, { Allow: "GET, OPTIONS" });
      return;
    }
    json(res, 200, {
      provider: "Gemini",
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: cleanText(process.env.GEMINI_MODEL || "gemini-3.8-flash", 80)
    });
    return;
  }
  if (url.pathname === "/api/assistant") {
    if (req.method === "POST") {
      try {
        req.body = await readAssistantRequestBody(req);
      } catch (error) {
        json(res, Number(error.statusCode) || 400, { error: Number(error.statusCode) === 413 ? "request_too_large" : "invalid_request" });
        return;
      }
    }
    return geminiAssistantHandler(req, res);
  }
  if (await handleMarketplaceRequest(req, res, url)) return;
  if (await handleJobsRequest(req, res, url)) return;
  if (url.pathname === "/api/geoapify/status") {
    json(res, 200, {
      provider: "Geoapify",
      dataSource: "OpenStreetMap",
      geoapifyEnabled: geoapifyEnabled(),
      freePlanDailyCredits: 3000,
      creditCardRequired: false,
      phoneNumbers: "available-when-listed-in-source"
    });
    return;
  }
  if (url.pathname === "/api/geoapify/search") {
    const searchStartedAt = Date.now();
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" }, { "Allow": "GET, OPTIONS" });
      return;
    }
    if (!rateLimit(req)) {
      json(res, 429, { code: "RATE_LIMITED", error: "عدد عمليات البحث كبير. انتظر قليلاً ثم حاول مجدداً." });
      return;
    }
    try {
      const result = await searchGeoapifyPlaces({
        q: url.searchParams.get("q"),
        place: url.searchParams.get("place"),
        fallbackPlace: url.searchParams.get("fallbackPlace"),
        category: url.searchParams.get("category"),
        lat: url.searchParams.get("lat"),
        lon: url.searchParams.get("lon"),
        radius: url.searchParams.get("radius")
      });
      console.info(JSON.stringify({ event: "geoapify.search.complete", category: result.category || "all", count: result.count, cached: result.cached, durationMs: Date.now() - searchStartedAt }));
      json(res, 200, result);
    } catch (error) {
      const status = Number(error.statusCode) || 502;
      console.warn(JSON.stringify({ event: "geoapify.search.error", status, code: cleanText(error.code, 80), durationMs: Date.now() - searchStartedAt }));
      json(res, status, { code: cleanText(error.code, 80) || "GEOAPIFY_ERROR", error: cleanText(error.message, 240) || "تعذر البحث في Geoapify." });
    }
    return;
  }
  if (url.pathname === "/api/places/status") {
    json(res,200,{activeProvider:geoapifyEnabled()?"Geoapify":"OpenStreetMap",paidProvidersDisabled:true,photoProvider:"Wikimedia Commons",ratingsStorage:"local-device"});
    return;
  }
  if(url.pathname==="/api/places/photos"){
    if(req.method!=="GET"){json(res,405,{error:"Method not allowed"},{Allow:"GET, OPTIONS"});return;}
    if(!rateLimit(req)){json(res,429,{error:"طلبات كثيرة. انتظر قليلاً ثم حاول."});return;}
    try{
      const result=await searchCommonsPhotos(url.searchParams.get("q"),url.searchParams.get("place"));
      json(res,200,result);
    }catch(error){json(res,Number(error.statusCode)||502,{error:cleanText(error.message,220)});}
    return;
  }
  if (url.pathname === "/health") {
    json(res, 200, { ok: true, service: "dalilna-live", version: VERSION });
    return;
  }
  if(url.pathname==="/api/places/details"||url.pathname==="/api/places/photo"){
    json(res,404,{error:"هذا المسار غير متاح. يستخدم دليلنا مصادر الخرائط المفتوحة."});
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
      console.info(JSON.stringify({
        event:"places.search.start",
        place:cleanText(url.searchParams.get("place"),100),
        query:cleanText(url.searchParams.get("q"),100),
        requestedCategory:cleanText(url.searchParams.get("category"),30),
        origin:cleanText(req.headers.origin,180)
      }));
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

module.exports = { buildOverpassQuery, buildYemenOverpassQuery, searchYemenOverpass, inferCategoryFromQuery, categoryRuleMatches, categoriesForTags, classifyCategory, normalizeElement, normalizeText, searchPlaces, searchGeoapifyPlaces, geoapifyEnabled, geoapifyRectFilter, geoapifyCategoryLabel, createIntervalGate, overpassAttemptTimeout, searchCommonsPhotos, searchLocalYemenCatalog, loadLocalYemenIndex, server };
