"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOverpassQuery, classifyCategory, normalizeElement, normalizeText, createIntervalGate } = require("../server");

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
