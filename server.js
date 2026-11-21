"use strict";

const http = require("node:http");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 10000);
const VERSION = "1.6.1";
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
const commonsCache = new Map();
const geocodeCache = new Map();
const rateBuckets = new Map();
let lastGeocodeAt = 0;
let lastOverpassAt = 0;


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
  const pathname = String(req.url || "").split("?")[0];
  // These endpoints return public map data only. Wildcard CORS avoids brittle
  // hostname allowlists for Render previews, PWA hosts and Android WebView.
  if (pathname === "/health" || pathname.startsWith("/api/places/") || pathname.startsWith("/api/geoapify/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
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


function createIntervalGate(intervalMs) {
  let nextAt = 0;
  let queue = Promise.resolve();
  return function waitForSlot() {
    const reservation = queue.then(async () => {
      const delay = Math.max(0, nextAt - Date.now());
      if (delay) await sleep(delay);
      nextAt = Date.now() + intervalMs;
    });
    queue = reservation.catch(() => {});
    return reservation;
  };
}
const waitForNominatimSlot = createIntervalGate(1100);
const waitForOverpassSlot = createIntervalGate(1100);
const waitForCommonsSlot = createIntervalGate(1100);

function buildOverpassQuery(bbox, category) {
  const filters = FILTERS[category] || FILTERS.all;
  const box = [bbox.south, bbox.west, bbox.north, bbox.east].map(n => Number(n).toFixed(6)).join(",");
  const union = filters.map(filter => "nwr" + filter + "(" + box + ");").join("\n");
  return "[out:json][timeout:12][maxsize:134217728];\n(\n" + union + "\n);\nout center tags 80;";
}

function inferCategoryFromQuery(query) {
  const text = normalizeText(query);
  if (!text) return "";
  const rules = [
    ["grocery", /(بقال|تموين|سوبر\s?ماركت|مواد\s?غذائي|ميني\s?ماركت)/u],
    ["pharmacy", /(صيدل|دواء|ادويه|علاج|عياده|مستشف|مركز صحي|مختبر|طبيب)/u],
    ["food", /(مطعم|مطاعم|مخبز|مخابز|وجبات|فطور|غداء|عشاء)/u],
    ["cafe", /(بوفيه|كافيه|كوفي|قهوه|كافتيريا)/u],
    ["edu", /(مدرس|مدارس|معهد|جامعه|كليه)/u],
    ["mosque", /(مسجد|مساجد|جامع|جوامع)/u],
    ["money", /(بنك|صراف|صرافه|تحويل|صرف عمله)/u],
    ["transport", /(تاكسي|باص|مواصلات|نقل)/u],
    ["hotel", /(فندق|فنادق|نزل|شقق مفروشه)/u],
    ["market", /(سوق|اسواق|سوق مركزي)/u],
    ["salon", /(حلاق|حلاقه|صالون)/u],
    ["laundry", /(مغسله|مغاسل|غسيل ملابس|كوي)/u]
  ];
  const match = rules.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : "";
}

const GEOAPIFY_CATEGORY_MAP = {
  grocery: ["commercial.supermarket", "commercial.convenience", "commercial.marketplace"],
  food: ["catering.restaurant", "catering.fast_food", "catering.food_court"],
  cafe: ["catering.cafe"],
  pharmacy: ["healthcare.pharmacy"],
  health: ["healthcare.hospital", "healthcare.clinic_or_praxis", "healthcare.dentist", "healthcare.pharmacy", "commercial.health_and_beauty.pharmacy"],
  edu: ["education.school", "education.college", "education.university", "childcare.kindergarten"],
  gov: ["office.government"],
  money: ["service.financial.bank", "service.financial.atm", "service.financial.bureau_de_change", "service.financial.money_transfer"],
  craft: ["commercial", "service"],
  transport: ["service.taxi", "public_transport"],
  mosque: ["religion.place_of_worship.islam"],
  hotel: ["accommodation.hotel", "accommodation.guest_house", "accommodation.hostel"],
  market: ["commercial.marketplace"],
  solar: ["commercial.elektronics", "commercial.energy", "service.electrician"],
  parts: ["commercial.vehicle"],
  build: ["commercial.houseware_and_hardware.building_materials", "commercial.houseware_and_hardware.hardware_and_tools"],
  clothes: ["commercial.clothing"],
  home: ["commercial.furniture_and_interior", "commercial.houseware_and_hardware"],
  books: ["commercial.books", "commercial.stationery"],
  beauty: ["commercial.health_and_beauty", "service.beauty"],
  salon: ["service.beauty.hairdresser"],
  laundry: ["service.cleaning.laundry"],
  delivery: ["service.post", "service.post.office", "service.post.parcel_locker"],
  utility: ["service.vehicle.fuel", "commercial.energy"],
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

function geoapifyCategoryLabel(category, properties = {}) {
  const labels = {
    grocery:"بقالات وتموينات",food:"مطاعم ومخابز",cafe:"كافيهات وبوفيهات",
    pharmacy:"صيدليات",health:"مراكز صحية",edu:"تعليم ومدارس",
    gov:"جهات حكومية",money:"بنوك وصرافة",craft:"حرف وخدمات",
    transport:"مواصلات",mosque:"مساجد",hotel:"فنادق وسكن",
    market:"أسواق",solar:"طاقة شمسية وكهربائيات",parts:"قطع غيار",
    build:"مواد بناء",clothes:"ملابس",home:"أثاث ومستلزمات منزلية",
    books:"مكتبات وقرطاسية",beauty:"تجميل وعناية",salon:"صالونات",
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
      headers: { "Accept": "application/json", "User-Agent": "DalilnaDirectory/1.6.1 (+https://dalilna-yemen.onrender.com)" }
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
  if ((!place || normalizeText(place) === "اليمن" || normalizeText(place) === "yemen") && !hasCoordinates) {
    const error = new Error("اختر محافظة أو مديرية أولاً، أو فعّل البحث حول موقعك.");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = (hasCoordinates ? "near:" + lat.toFixed(3) + ":" + lon.toFixed(3) : normalizeText(place)) + "|" + category + "|" + normalizeText(query);
  const cached = readCache(geoapifyCache, cacheKey);
  if (cached) return { ...cached, cached: true, fetchedAt: new Date().toISOString() };

  let area = null, scopeFallback = false, usedPlace = place || "بالقرب من موقعك";
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
  if (!area || !area.bbox) {
    const error = new Error("تعذر تحديد نطاق المنطقة. اختر محافظة أو مديرية أخرى.");
    error.statusCode = 404;
    throw error;
  }

  const categories = GEOAPIFY_CATEGORY_MAP[category] || GEOAPIFY_ALL_CATEGORIES;
  const searchUrl = new URL("https://api.geoapify.com/v2/places");
  const west = Math.min(area.bbox.west, area.bbox.east);
  const east = Math.max(area.bbox.west, area.bbox.east);
  const south = Math.min(area.bbox.south, area.bbox.north);
  const north = Math.max(area.bbox.south, area.bbox.north);
  const searchParams = {
    categories: categories.join(","),
    filter: "rect:" + [west, north, east, south].join(","),
    limit: "8",
    lang: "ar",
    apiKey
  };
  if (query && category === "all") searchParams.name = query;
  searchUrl.search = new URLSearchParams(searchParams).toString();
  const payload = await geoapifyRequest(searchUrl, 12000);
  const features = Array.isArray(payload.features) ? payload.features : [];
  const baseItems = features.map(feature => {
    const props = feature && feature.properties ? feature.properties : {};
    const name = cleanText(props.name, 180);
    if (!name) return null;
    const pLat = Number(props.lat), pLon = Number(props.lon);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return null;
    const address = cleanText(props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join("، "), 240);
    const itemId = cleanText(props.place_id || props.datasource && props.datasource.raw && props.datasource.raw.osm_id || "", 200);
    const mapsUrl = geoapifyMapsUrl(name, address, pLat, pLon);
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
      mapsUrl,
      sourceUrl: "https://www.openstreetmap.org/?mlat=" + pLat + "&mlon=" + pLon + "#map=18/" + pLat + "/" + pLon,
      source: "Geoapify"
    };
  }).filter(Boolean);

  // Contact details are fetched only for the eight visible cards. Place Details
  // costs one credit per request, so the page never requests details for hidden
  // or unused results. Geoapify's free quota is shared by Places and Details.
  const items = [];
  for (const item of baseItems.slice(0, 8)) {
    const details = item.placeId ? await geoapifyPlaceDetails(item.placeId, apiKey) : {};
    items.push({ ...item, ...details });
  }

  const result = {
    source: "Geoapify",
    items,
    count: items.length,
    place: usedPlace,
    scopeFallback,
    attribution: "Powered by Geoapify · © OpenStreetMap contributors",
    attributionUrl: "https://www.geoapify.com/",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    cached: false,
    fetchedAt: new Date().toISOString(),
    note: "الأرقام والمواقع تظهر عند توفرها في بيانات OpenStreetMap. قد لا يكون لكل محل رقم هاتف مسجل."
  };
  touchCache(geoapifyCache, cacheKey, result, 10 * 60 * 1000);
  return result;
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
    description: cleanText(tags.description || tags.note || "", 500),
    cuisine: cleanText(tags.cuisine || "", 120),
    brand: cleanText(tags.brand || "", 120),
    operator: cleanText(tags.operator || "", 120),
    email: cleanText(tags["contact:email"] || tags.email || "", 160),
    mapsUrl: "https://www.openstreetmap.org/?mlat=" + lat + "&mlon=" + lon + "#map=18/" + lat + "/" + lon
  };
}

async function geocodePlace(place) {
  const key=normalizeText(place);
  const cached=readCache(geocodeCache,key);
  if(cached)return cached;
  const cleanedPlace=cleanText(place.replace(/(?:^|،\s*)(?:محافظة|مديرية|عزلة)\s*/gu," ").replace(/،\s*اليمن$/g,"").replace(/\s+/g," "),180);
  const candidates=[...new Set([place,cleanedPlace+"، اليمن"].filter(Boolean))];
  let lastError=null;
  for(const candidate of candidates){
    await waitForNominatimSlot();
    lastGeocodeAt=Date.now();
    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.search=new URLSearchParams({q:candidate,format:"jsonv2",addressdetails:"1",limit:"5",countrycodes:"ye","accept-language":"ar,en"}).toString();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json","User-Agent":"DalilnaDirectory/1.6.1 (+https://dalilna-live.onrender.com)","Referer":"https://dalilna-live.onrender.com/"}});
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
  const endpoints=[
    {name:"FOSSGIS",url:"https://overpass-api.de/api/interpreter",timeoutMs:12000},
    {name:"Private.coffee",url:"https://overpass.private.coffee/api/interpreter",timeoutMs:15000},
    {name:"VK Maps",url:"https://maps.mail.ru/osm/tools/overpass/api/interpreter",timeoutMs:18000}
  ];
  let lastError=null;
  let hadValidEmpty=false;
  for(const provider of endpoints){
    await waitForOverpassSlot();
    lastOverpassAt=Date.now();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),provider.timeoutMs),startedAt=Date.now();
    try{
      const response=await fetch(provider.url,{
        method:"POST",
        signal:controller.signal,
        headers:{
          "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8",
          "Accept":"application/json",
          "User-Agent":"DalilnaDirectory/1.6.1 (+https://dalilna-live.onrender.com)"
        },
        body:new URLSearchParams({data:query})
      });
      if([429,503,504].includes(response.status)){
        lastError=new Error("مصدر بيانات الأماكن مشغول حالياً.");
        console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,status:response.status,durationMs:Date.now()-startedAt}));
        continue;
      }
      if(!response.ok){
        lastError=new Error("تعذّر جلب بيانات الأماكن من المصدر المفتوح.");
        console.warn(JSON.stringify({event:"places.overpass.retry",provider:provider.name,status:response.status,durationMs:Date.now()-startedAt}));
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
      "User-Agent":"DalilnaDirectory/1.6.1 (https://dalilna-live.onrender.com; contact: dalilna project)"
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

async function searchPlaces(params) {
  const place = cleanText(params.place, 180);
  const fallbackPlace = cleanText(params.fallbackPlace, 180);
  const query = cleanText(params.q, 100);
  const requestedCategory = FILTERS[params.category] ? params.category : "all";
  const category = requestedCategory === "all"
    ? (inferCategoryFromQuery(query) || "all")
    : requestedCategory;
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
    const error = new Error("لم نعثر على حدود هذه المديرية في بيانات الخريطة. اختر المحافظة أو افتح البحث في OpenStreetMap.");
    error.statusCode = 404;
    throw error;
  }

  if (!area.bbox) {
    const error = new Error("تعذر تحديد نطاق المنطقة من مصادر الخرائط. افتح البحث مباشرة في OpenStreetMap.");
    error.statusCode = 404;
    throw error;
  }
  const cachedOsm = readCache(resultCache, cacheKey);
  if (cachedOsm) {
    const copy = {...cachedOsm,fetchedAt:new Date().toISOString(),cached:true};
    return filterByQuery(copy,query,category);
  }
  const items = await fetchOverpass(area.bbox, category, area.label || usedPlace);
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
      console.info(JSON.stringify({ event: "geoapify.search.complete", count: result.count, cached: result.cached, durationMs: Date.now() - searchStartedAt }));
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
    json(res, 200, { ok: true, service: "dalilna-directory-api", version: VERSION });
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

module.exports = { buildOverpassQuery, inferCategoryFromQuery, classifyCategory, normalizeElement, normalizeText, searchPlaces, searchGeoapifyPlaces, geoapifyEnabled, geoapifyCategoryLabel, createIntervalGate, searchCommonsPhotos, server };
