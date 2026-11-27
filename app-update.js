"use strict";
(() => {
  const VERSION_URL = "./version.json";
  const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ye.dalilna.app";
  const $ = id => document.getElementById(id);
  function parseVersion(value) {
    const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
    return match ? match.slice(1, 4).map(Number) : null;
  }
  function compareVersions(left, right) {
    for (let i=0;i<3;i++) {
      if (left[i]>right[i]) return 1;
      if (left[i]<right[i]) return -1;
    }
    return 0;
  }
  function removeBanner() { $("dalilnaUpdateBanner")?.remove(); }
  function showBanner(version) {
    const bridge=window.DalilnaNative;
    if (!bridge || typeof bridge.getVersionName!=="function") return;
    const installed=parseVersion(bridge.getVersionName());
    const available=parseVersion(version.androidVersion || version.version);
    if (!installed || !available || compareVersions(available,installed)<=0) {
      removeBanner();
      return;
    }
    let banner=$("dalilnaUpdateBanner");
    if (!banner) {
      banner=document.createElement("div");
      banner.id="dalilnaUpdateBanner";
      banner.className="dalilna-update-banner";
      banner.setAttribute("role","status");
      const message=document.createElement("span");
      message.textContent="يتوفر تحديث جديد لتطبيق دليلنا عبر Google Play";
      const button=document.createElement("button");
      button.type="button";
      button.textContent="التحديث من Google Play";
      button.addEventListener("click",()=>window.location.assign(PLAY_STORE_URL));
      banner.append(message,button);
      const appHeader=document.querySelector(".app");
      if(appHeader)appHeader.insertAdjacentElement("afterend",banner);
      else document.body.prepend(banner);
    }
    banner.hidden=false;
  }
  async function check() {
    const bridge=window.DalilnaNative;
    if(!bridge || typeof bridge.getVersionName!=="function") return;
    try {
      const response=await fetch(VERSION_URL,{cache:"no-store"});
      if(!response.ok) return;
      showBanner(await response.json());
    } catch (_) {}
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",check,{once:true});
  else check();
})();
