"use strict";
(function(root){
 function isRecord(value){return !!(value&&typeof value==="object"&&!Array.isArray(value)&&(value.name||value.category||value.tags||value.lat!==undefined||value.lon!==undefined||value.latitude!==undefined));}
 function normalizeItems(payload){
  const records=[];
  const append=(value,fallbackId)=>{
   if(!isRecord(value))return;
   const id=value?.id??value?.osmId??value?.osm_id??value?.key??fallbackId??("catalog-"+records.length);
   records.push({...value,id:String(id)});
  };
  const fromCollection=value=>{
   if(Array.isArray(value)){value.forEach((item,index)=>append(item,"catalog-"+index));return true;}
   if(value&&typeof value==="object"){for(const [key,item] of Object.entries(value))append(item,key);return records.length>0;}
   return false;
  };
  if(Array.isArray(payload)){fromCollection(payload);return records;}
  if(!payload||typeof payload!=="object")return records;
  for(const key of ["items","places","results","records","features","data"]){
   const candidate=payload?.[key];
   if(fromCollection(candidate))return records;
  }
  fromCollection(payload);
  return records;
 }
 function normalizeArabic(value){
  return String(value||"").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g,"")
   .replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي")
   .replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^\u0600-\u06FF0-9a-z\s]/gi," ")
   .replace(/\s+/g," ").trim().toLowerCase();
 }
 function yemenPhone(phone){
  let value=String(phone||"").replace(/\D/g,"");
  if(value.startsWith("00"))value=value.slice(2);
  if(value.startsWith("967"))value=value.slice(3);
  if(value.startsWith("0"))value=value.slice(1);
  const mobile=/^7[01378]\d{7}$/.test(value);
  return {local:value,isMobile:mobile,whatsapp:mobile?"967"+value:""};
 }
 const api={isRecord,normalizeItems,normalizeArabic,yemenPhone};
 root.DalilnaRegionalCatalog=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
