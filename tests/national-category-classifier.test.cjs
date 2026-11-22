"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {categoriesForTags,classifyCategory,categoryRuleMatches,normalizeElement}=require("../server");
const mapping=JSON.parse(fs.readFileSync("category-mapping.json","utf8"));
const examples=[[{"shop":"convenience"},"grocery"],[{"amenity":"restaurant"},"food"],[{"amenity":"cafe"},"cafe"],[{"amenity":"school"},"edu"],[{"amenity":"hospital"},"health"],[{"amenity":"pharmacy"},"pharmacy"],[{"office":"government"},"gov"],[{"amenity":"bank"},"money"],[{"shop":"hardware"},"build"],[{"__catalog_categories":["parts"]},"parts"],[{"craft":"plumber"},"craft"],[{"amenity":"bus_station"},"transport"],[{"shop":"mobile_phone"},"telecom"],[{"amenity":"drinking_water"},"utility"],[{"shop":"agrarian"},"farm"],[{"building":"mosque"},"mosque"],[{"shop":"jewellery"},"gold"],[{"amenity":"events_venue"},"wedding"],[{"tourism":"hotel"},"hotel"],[{"amenity":"marketplace"},"market"],[{"shop":"solar"},"solar"],[{"shop":"electronics"},"elec"],[{"shop":"clothes"},"clothes"],[{"shop":"furniture"},"home"],[{"shop":"books"},"books"],[{"shop":"cosmetics"},"beauty"],[{"office":"courier"},"delivery"],[{"shop":"hairdresser"},"salon"],[{"shop":"laundry"},"laundry"],[{"building":"commercial"},"other"],[{"office":"estate_agent"},"real_estate"],[{"shop":"car"},"vehicles"]];
test("national directory has exactly 32 primary category definitions",()=>{
 assert.equal(Object.keys(mapping.categories).length,32);
 assert.deepEqual(new Set(mapping.primaryCategoryOrder),new Set(Object.keys(mapping.categories)));
});
test("live POI classifier produces one matching primary category for all 32 sections",()=>{
 for(const [tags,expected] of examples){
  assert.deepEqual(categoriesForTags(tags),[expected],JSON.stringify(tags));
  assert.equal(classifyCategory(tags),expected);
 }
});
test("health and vehicle tags never cross primary category boundaries",()=>{
 assert.deepEqual(categoriesForTags({amenity:"hospital",shop:"car"}),["health"]);
 assert.deepEqual(categoriesForTags({amenity:"pharmacy",shop:"car_parts"}),["pharmacy"]);
 assert.deepEqual(categoriesForTags({healthcare:"pharmacy",amenity:"clinic"}),["pharmacy"]);
 for(const tag of ["car","car_repair","car_parts","motorcycle","motorcycle_parts","vehicle_parts"])
  assert.equal(classifyCategory({shop:tag}),"vehicles",tag);
});
test("strict rules respect their optional when condition",()=>{
 const rule={key:"shop",value:"appliance",category:"home",when:{key:"amenity",value:"marketplace"}};
 assert.equal(categoryRuleMatches({shop:"appliance"},rule),false);
 assert.equal(categoryRuleMatches({shop:"appliance",amenity:"marketplace"},rule),true);
});
test("non-directory benches are excluded instead of appearing as businesses",()=>{
 assert.deepEqual(categoriesForTags({amenity:"bench"}),[]);
 assert.equal(normalizeElement({type:"node",id:44,lat:15,lon:44,tags:{name:"Bench",amenity:"bench"}},"Yemen"),null);
});
test("live POI cards preserve the primary category and contact fields",()=>{
 const item=normalizeElement({type:"node",id:777,lat:15,lon:44,tags:{name:"Test Pharmacy",amenity:"pharmacy",phone:"777123456"}},"Yemen");
 assert.equal(item.category,"pharmacy");
 assert.equal(item.phone,"777123456");
});
