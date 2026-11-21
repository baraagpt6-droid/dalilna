"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validate,PRODUCT_TYPES,CATEGORIES,GOVERNORATES}=require("../marketplace-api");
test("taxonomy covers Yemen service categories and product types",()=>{assert.equal(GOVERNORATES.size,22);for(const x of ["phone","watch","car","motorcycle","land","property","honey","coffee"])assert.ok(PRODUCT_TYPES.has(x));for(const x of ["jobs","souq","grocery","health","pharmacy"])assert.ok(CATEGORIES.has(x));});
test("normalizes a used phone listing",()=>{const x=validate({title:"هاتف",category:"souq",productType:"phone",condition:"used",governorate:"إب",district:"حبيش",area:"ربع ظلمة",clientRef:"local-1"});assert.equal(x.productType,"phone");assert.equal(x.condition,"used");assert.equal(x.governorate,"إب");assert.equal(x.clientRef,"local-1");});
test("accepts land and property as classified marketplace listings",()=>{
 const land=validate({title:"أرض للبيع",category:"land",productType:"land",listingType:"sale",governorate:"إب",district:"حبيش"});
 assert.equal(land.category,"land");
 assert.equal(land.productType,"land");
 const property=validate({title:"منزل",category:"land",productType:"property",governorate:"عدن"});
 assert.equal(property.productType,"property");
});
test("requires expiry dates only for jobs",()=>{assert.equal(validate({title:"وظيفة",category:"jobs",deadline:"2026-12-31"}).deadline,"2026-12-31");assert.throws(()=>validate({title:"ساعة",category:"souq",productType:"watch",deadline:"2026-12-31"}),/مخصص للوظائف/);});
test("rejects invalid categories, product types and governorates",()=>{assert.throws(()=>validate({title:"x",category:"nonsense"}),/القسم المحدد غير معروف/);assert.throws(()=>validate({title:"x",category:"souq",productType:"weapon"}),/نوع المعروض غير معروف/);assert.throws(()=>validate({title:"x",category:"souq",governorate:"خيالية"}),/اختر محافظة يمنية/);});
test("rejects unsafe or oversized image data",()=>{assert.throws(()=>validate({title:"x",category:"grocery",img:"https://example.com/a.jpg"}),/صيغة الصورة غير مدعومة/);assert.throws(()=>validate({title:"x",category:"souq",img:"data:image/jpeg;base64,"+"A".repeat(400001)}),/حجم الصورة أكبر/);});
test("validates coordinate pairs and currency",()=>{assert.throws(()=>validate({title:"x",category:"grocery",latitude:15.3}),/أرسل خط العرض وخط الطول معاً/);assert.throws(()=>validate({title:"x",category:"grocery",currency:"BTC"}),/العملة غير معروفة/);assert.equal(validate({title:"محل",category:"grocery",latitude:15.3,longitude:44.2}).latitude,15.3);});
