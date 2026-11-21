"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOverpassQuery, buildGoogleTextSearchBody, normalizeGooglePlace, normalizeGooglePlaceDetails, isGooglePlacesEnabled, classifyCategory, normalizeElement, normalizeText, createIntervalGate } = require("../server");

test("builds a narrow grocery query for a supplied bounding box", () => {
  const query = buildOverpassQuery({south:13.1, west:43.2, north:13.4, east:43.5}, "grocery");
  assert.match(query, /shop/);
  assert.match(query, /convenience/);
  assert.match(query, /supermarket/);
  assert.match(query, /13\.100000,43\.200000,13\.400000,43\.500000/);
  assert.match(query, /\[timeout:12\]/);
  assert.match(query, /maxsize:134217728/);
  assert.match(query, /out center tags 80/);
});

test("classifies common OpenStreetMap business tags", () => {
  assert.equal(classifyCategory({shop:"convenience"}), "grocery");
  assert.equal(classifyCategory({amenity:"pharmacy"}), "pharmacy");
  assert.equal(classifyCategory({amenity:"restaurant"}), "food");
  assert.equal(classifyCategory({amenity:"school"}), "edu");
  assert.equal(classifyCategory({tourism:"hotel"}), "hotel");
});

test("normalizes OSM features and retains source identifiers", () => {
  const item = normalizeElement({
    type:"node",
    id:123,
    lat:13.3,
    lon:43.1,
    tags:{name:"بقالة الاختبار",shop:"convenience",phone:"777123456","opening_hours":"08:00-22:00"}
  }, "حبيش، إب، اليمن");
  assert.ok(item);
  assert.equal(item.id, "osm-node-123");
  assert.equal(item.category, "grocery");
  assert.equal(item.phone, "777123456");
  assert.equal(item.openingHours, "08:00-22:00");
  assert.match(item.sourceUrl, /openstreetmap\.org\/node\/123/);
  assert.match(item.mapsUrl, /google\.com\/maps/);
});

test("ignores unnamed or unlocated map objects", () => {
  assert.equal(normalizeElement({type:"way",id:9,center:{lat:13,lon:43},tags:{shop:"convenience"}},"إب"), null);
  assert.equal(normalizeElement({type:"node",id:10,tags:{name:"بقالة"}}, "إب"), null);
});

test("normalizes Arabic spelling for live filtering", () => {
  assert.equal(normalizeText("أَبْرَاء"), "ابراء");
});


test("Vercel Places route exports a Node handler and a bounded duration", () => {
  const handler = require("../api/places/search");
  assert.equal(typeof handler, "function");
  assert.equal(handler.config.maxDuration, 60);
});


test("central request gate serializes concurrent callers", async () => {
  const waitForSlot=createIntervalGate(35);
  const started=[];
  await Promise.all(Array.from({length:3},async()=>{await waitForSlot();started.push(Date.now());}));
  started.sort((a,b)=>a-b);
  assert.ok(started[1]-started[0]>=25);
  assert.ok(started[2]-started[1]>=25);
});

test("builds Google Places Text Search constrained to the selected district", () => {
  const body=buildGoogleTextSearchBody({bbox:{south:13.1,west:44.1,north:13.3,east:44.3}},"grocery","بقالة","مديرية حبيش، محافظة إب، اليمن");
  assert.match(body.textQuery,/grocery stores/);
  assert.match(body.textQuery,/مديرية حبيش/);
  assert.equal(body.pageSize,20);
  assert.equal(body.regionCode,"YE");
  assert.equal(body.locationRestriction.rectangle.low.latitude,13.1);
  assert.equal(body.locationRestriction.rectangle.high.longitude,44.3);
  assert.equal(body.includedType,"grocery_store");
});

test("allows Google text search by region name when Nominatim has no bounds", () => {
  const body=buildGoogleTextSearchBody({bbox:null},"pharmacy","","مديرية حبيش، محافظة إب، اليمن");
  assert.match(body.textQuery,/pharmacies/);
  assert.equal(body.locationRestriction,undefined);
});

test("normalizes Google Places but does not copy phone or website", () => {
  const item=normalizeGooglePlace({
    id:"ChIJTestPlaceId",
    displayName:{text:"بقالة الاختبار"},
    formattedAddress:"حبيش، إب، اليمن",
    location:{latitude:13.2,longitude:44.2},
    googleMapsUri:"https://www.google.com/maps/place/test"
  },"grocery","حبيش، إب");
  assert.equal(item.name,"بقالة الاختبار");
  assert.equal(item.provider,"Google Maps");
  assert.equal(item.phone,"");
  assert.equal(item.website,"");
  assert.deepEqual(item.openingHours,[]);
  assert.equal(item.id,"google-ChIJTestPlaceId");
  assert.match(item.mapsUrl,/google\.com\/maps/);
});

test("Google Places stays disabled unless both the feature flag and API key are present", () => {
  assert.equal(isGooglePlacesEnabled({}), false);
  assert.equal(isGooglePlacesEnabled({GOOGLE_PLACES_API_KEY:"test-key"}), false);
  assert.equal(isGooglePlacesEnabled({GOOGLE_PLACES_ENABLED:"true"}), false);
  assert.equal(isGooglePlacesEnabled({GOOGLE_PLACES_ENABLED:"true",GOOGLE_PLACES_API_KEY:"test-key"}), true);
  assert.equal(isGooglePlacesEnabled({GOOGLE_PLACES_ENABLED:"false",GOOGLE_PLACES_API_KEY:"test-key"}), false);
});

test("normalizes Google search results with rating and business information", () => {
  const item=normalizeGooglePlace({
    id:"ChIJBusinessPlace",
    displayName:{text:"مطعم الاختبار"},
    formattedAddress:"صنعاء، اليمن",
    location:{latitude:15.35,longitude:44.2},
    googleMapsUri:"https://www.google.com/maps/place/test",
    nationalPhoneNumber:"+9671234567",
    websiteUri:"https://example.test",
    rating:4.6,
    userRatingCount:128,
    businessStatus:"OPERATIONAL",
    priceLevel:"PRICE_LEVEL_MODERATE",
    currentOpeningHours:{openNow:true,weekdayDescriptions:["الأحد: 8 ص – 10 م"]},
    primaryTypeDisplayName:{text:"مطعم"}
  },"food","صنعاء، اليمن");
  assert.equal(item.phone,"+9671234567");
  assert.equal(item.website,"https://example.test");
  assert.equal(item.rating,4.6);
  assert.equal(item.ratingCount,128);
  assert.equal(item.openNow,true);
  assert.equal(item.businessStatus,"OPERATIONAL");
  assert.equal(item.priceLevel,"PRICE_LEVEL_MODERATE");
  assert.deepEqual(item.openingHours,["الأحد: 8 ص – 10 م"]);
});

test("normalizes Google photos and visitor reviews with author attribution", () => {
  const item=normalizeGooglePlaceDetails({
    id:"ChIJBusinessPlace",
    displayName:{text:"مطعم الاختبار"},
    formattedAddress:"صنعاء، اليمن",
    location:{latitude:15.35,longitude:44.2},
    googleMapsUri:"https://www.google.com/maps/place/test",
    rating:4.7,
    userRatingCount:51,
    photos:[{name:"places/ChIJBusinessPlace/photos/PhotoIdentifier123",authorAttributions:[{displayName:"صاحب الصورة",uri:"https://maps.google.com/maps/contrib/123",photoUri:"https://example.test/avatar"}]}],
    reviews:[{rating:5,text:{text:"خدمة ممتازة"},relativePublishTimeDescription:"قبل شهر",authorAttribution:{displayName:"زائر",uri:"https://maps.google.com/maps/contrib/456",photoUri:"https://example.test/reviewer"}}]
  });
  assert.equal(item.rating,4.7);
  assert.equal(item.photos[0].authorAttributions[0].displayName,"صاحب الصورة");
  assert.equal(item.reviews[0].text,"خدمة ممتازة");
  assert.equal(item.reviews[0].author.displayName,"زائر");
  assert.equal(item.reviews[0].rating,5);
});

test("Google photo proxy requests a short-lived URI without forwarding the API key to the photo host", () => {
  const source=require("node:fs").readFileSync(require.resolve("../server"),"utf8");
  const photoFn=source.slice(source.indexOf("async function fetchGooglePlacePhoto"),source.indexOf("async function searchPlaces"));
  assert.match(photoFn,/skipHttpRedirect/);
  assert.match(photoFn,/photoUri/);
  assert.match(photoFn,/googleusercontent\.com/);
  assert.match(photoFn,/headers:\s*\{\s*"Accept": "image\/\*"\s*\}/);
  assert.doesNotMatch(photoFn,/headers:\s*\{[^}]*X-Goog-Api-Key[^}]*\}\s*,\s*redirect:\s*"follow"/s);
});
