"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {categoriesForTags,classifyCategory,normalizeElement}=require("../server");
test("live classifier follows the national one-primary-category mapping",()=>{
 const cases=[
  [{amenity:"pharmacy"},"pharmacy"],[{healthcare:"pharmacy"},"pharmacy"],[{shop:"chemist"},"pharmacy"],
  [{amenity:"hospital"},"health"],[{healthcare:"clinic"},"health"],[{amenity:"marketplace"},"market"],
  [{shop:"supermarket"},"grocery"],[{amenity:"restaurant"},"food"],[{amenity:"cafe"},"cafe"],
  [{amenity:"school"},"edu"],[{office:"government"},"gov"],[{amenity:"atm"},"money"],
  [{office:"estate_agent"},"real_estate"],[{shop:"car"},"vehicles"],[{shop:"car_repair"},"vehicles"],
  [{shop:"car_parts"},"vehicles"],[{shop:"motorcycle"},"vehicles"],[{shop:"building_materials"},"build"],
  [{craft:"plumber"},"craft"],[{amenity:"taxi"},"transport"],[{shop:"mobile_phone"},"telecom"],
  [{amenity:"drinking_water"},"utility"],[{shop:"farm"},"farm"],[{building:"mosque"},"mosque"],
  [{shop:"jewellery"},"gold"],[{amenity:"events_venue"},"wedding"],[{tourism:"hotel"},"hotel"],
  [{shop:"solar"},"solar"],[{shop:"electronics"},"elec"],[{shop:"clothes"},"clothes"],
  [{shop:"furniture"},"home"],[{shop:"books"},"books"],[{shop:"cosmetics"},"beauty"],
  [{office:"courier"},"delivery"],[{shop:"barber"},"salon"],[{shop:"laundry"},"laundry"],
  [{building:"commercial"},"other"]
 ];
 for(const [tags,expected] of cases){assert.deepEqual(categoriesForTags(tags),[expected],JSON.stringify(tags));assert.equal(classifyCategory(tags),expected);}
});
test("overlapping health and vehicle tags resolve by national priority",()=>{
 assert.deepEqual(categoriesForTags({amenity:"hospital",shop:"car"}),["health"]);
 assert.deepEqual(categoriesForTags({amenity:"pharmacy",shop:"car_parts"}),["pharmacy"]);
});
test("conditional multi-category rules do not classify every place of worship as a mosque",()=>{
 assert.deepEqual(categoriesForTags({amenity:"place_of_worship",religion:"muslim"}),["mosque"]);
 assert.notDeepEqual(categoriesForTags({amenity:"place_of_worship",religion:"christian"}),["mosque"]);
});
test("public benches are excluded from business results",()=>{
 assert.deepEqual(categoriesForTags({amenity:"bench"}),[]);
 assert.equal(normalizeElement({type:"node",id:1,lat:15,lon:44,tags:{name:"Bench",amenity:"bench"}},"Yemen"),null);
});
test("named pharmacy retains one primary category and contact data",()=>{
 const item=normalizeElement({type:"node",id:22,lat:15,lon:44,tags:{name:"Test Pharmacy",amenity:"pharmacy",phone:"777123456"}},"Yemen");
 assert.equal(item.category,"pharmacy");assert.equal(item.phone,"777123456");
});
