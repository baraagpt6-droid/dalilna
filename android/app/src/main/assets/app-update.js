"use strict";
(() => {
  const VERSION_URL="./version.json";
  const $=id=>document.getElementById(id);
  function showBanner(version){
    const bridge=window.DalilnaNative;
    if(!bridge||typeof bridge.getVersionCode!=="function")return;
    const installed=Number(bridge.getVersionCode());
    const available=Number(version.androidVersionCode||0);
    const url=String(version.androidReleaseUrl||"");
    if(!Number.isSafeInteger(installed)||!Number.isSafeInteger(available)||available<=installed||!/^https:\/\//i.test(url))return;
    let banner=$("dalilnaUpdateBanner");
    if(!banner){
      banner=document.createElement("div");
      banner.id="dalilnaUpdateBanner";
      banner.className="dalilna-update-banner";
      banner.setAttribute("role","status");
      const message=document.createElement("span");
      message.textContent="يتوفر تحديث جديد لتطبيق دليلنا";
      const button=document.createElement("button");
      button.type="button";
      button.textContent="اضغط للتحديث";
      button.addEventListener("click",()=>{window.location.href=url;});
      banner.append(message,button);
      const appHeader=document.querySelector(".app");
      if(appHeader)appHeader.insertAdjacentElement("afterend",banner);
      else document.body.prepend(banner);
    }
    banner.hidden=false;
  }
  async function check(){
    if(!window.DalilnaNative||typeof window.DalilnaNative.getVersionCode!=="function")return;
    try{
      const response=await fetch(VERSION_URL,{cache:"no-store"});
      if(!response.ok)return;
      const version=await response.json();
      showBanner(version);
    }catch(_){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",check,{once:true});else check();
})();
