"use strict";
(() => {
  const native=window.DalilnaNative;
  if(!native)return;
  const MAX_BYTES=4*1024*1024;
  function snapshot(){
    const values={};
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key!==null)values[key]=localStorage.getItem(key);
      }
      const json=JSON.stringify(values);
      if(json.length<=MAX_BYTES)native.saveLocalStorage(json);
    }catch(_){}
  }
  function restore(){
    try{
      
      const raw=native.loadLocalStorage();
      if(!raw||raw.length>MAX_BYTES)return;
      const values=JSON.parse(raw);
      if(!values||typeof values!=="object"||Array.isArray(values))return;
      Object.entries(values).forEach(([key,value])=>{
        if(typeof key==="string"&&(typeof value==="string"||value===null))localStorage.setItem(key,value);
      });
    }catch(_){}
  }
  function observe(){
    const originalSet=Storage.prototype.setItem;
    const originalRemove=Storage.prototype.removeItem;
    const originalClear=Storage.prototype.clear;
    let timer=0;
    const schedule=()=>{window.clearTimeout(timer);timer=window.setTimeout(snapshot,250);};
    Storage.prototype.setItem=function(key,value){const result=originalSet.call(this,key,value);if(this===localStorage)schedule();return result;};
    Storage.prototype.removeItem=function(key){const result=originalRemove.call(this,key);if(this===localStorage)schedule();return result;};
    Storage.prototype.clear=function(){const result=originalClear.call(this);if(this===localStorage)schedule();return result;};
    window.addEventListener("pagehide",snapshot);
    window.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")snapshot();});
    window.addEventListener("dalilna:state-saved",snapshot);
    schedule();
  }
  const localOrigin=location.hostname==="appassets.androidplatform.net";
  const remoteOrigin=location.hostname==="baraagpt6-droid.github.io"&&location.pathname.startsWith("/dalilna/");
  if(remoteOrigin){
    restore();
    observe();
    try{native.markRemoteReady();}catch(_){}
  }else if(localOrigin){
    restore();
    observe();
    window.addEventListener("load",()=>{
      window.setTimeout(()=>{
        snapshot();
        try{native.switchToRemote();}catch(_){}
      },650);
    },{once:true});
  }
})();
