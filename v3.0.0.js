"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const KEYS = {market:"dalilna-marketplace-favs-v1",marketRecords:"dalilna-marketplace-fav-records-v1",jobs:"dalilna-job-favs-v1",jobRecords:"dalilna-job-favs-records-v1"};
  const readArray = key => {try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x:[];}catch(_){return [];}};
  const readMap = key => {try{const x=JSON.parse(localStorage.getItem(key)||"{}");return x&&typeof x==="object"&&!Array.isArray(x)?x:{};}catch(_){return {};}};
  const write = (key,value) => {try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}};
  const bridge = () => window.DALILNA_V3_BRIDGE;
  let tab="shops",feedPromise=null,savedFeed=[];
  const jobKey = job => String(job?.id||job?.url||job?.title||"");
  const safeUrl = value => {try{const u=new URL(String(value||""),location.href);return ["https:","tel:"].includes(u.protocol)?u.href:"";}catch(_){return "";}};
  const node = (tag,value,cls) => {const n=document.createElement(tag);n.textContent=String(value||"");if(cls)n.className=cls;return n;};
  function customerProfile(){try{const p=JSON.parse(localStorage.getItem("dalilna-v3-customer-profile")||"null");return p&&p.name&&p.phone?p:null;}catch(_){return null;}}
  function customerGate(trigger){
    let dlg=$("v3CustomerDialog");if(!dlg){dlg=document.createElement("dialog");dlg.id="v3CustomerDialog";dlg.className="v3-saved-dialog";
      const form=node("form","","v3-customer-form");form.innerHTML="<div class=\"v3-saved-heading\"><h2>تسجيل بيانات المستفيد</h2><button type=\"button\" class=\"v3-close\" aria-label=\"إغلاق\">×</button></div><p class=\"v3-saved-meta\">أدخل الاسم ورقم الجوال للمتابعة في إضافة إعلان أو تقييم. تحفظ البيانات محلياً على هذا الجهاز.</p><label>الاسم<input name=\"name\" maxlength=80 required></label><label>رقم الجوال<input name=\"phone\" type=\"tel\" inputmode=\"tel\" dir=\"ltr\" maxlength=24 required></label><p class=\"v3-customer-error\"></p><button type=\"submit\" class=\"v3-job-apply\">حفظ والمتابعة</button>";
      form.querySelector(".v3-close").addEventListener("click",()=>dlg.close());
      form.addEventListener("submit",event=>{event.preventDefault();const name=form.elements.name.value.trim(),phone=form.elements.phone.value.trim(),digits=phone.replace(/\D/g,"");if(!name||digits.length<8){form.querySelector(".v3-customer-error").textContent="أدخل اسماً ورقم جوال صحيحاً.";return;}localStorage.setItem("dalilna-v3-customer-profile",JSON.stringify({name,phone,updatedAt:new Date().toISOString()}));dlg.close();toast("تم حفظ بيانات المستفيد على هذا الجهاز");if(trigger?.isConnected)setTimeout(()=>trigger.click(),90);else if(bridge()?.snapshot?.().onboarded!==true)$("roleClientBtn")?.click();});
      dlg.append(form);document.body.append(dlg);
    }
    if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","");
  }
  async function loadMarketplaceSaved(){
    const ids=readArray(KEYS.market).map(String),records=readMap(KEYS.marketRecords),missing=ids.filter(id=>!records[id]);if(!missing.length)return;
    try{const base=String(window.DALILNA_API_BASE||"https://dalilna-live.onrender.com").replace(/\/$/,"");const response=await fetch(base+"/api/marketplace/listings?limit=100",{cache:"no-store",headers:{Accept:"application/json"}});if(!response.ok)return;const data=await response.json(),items=Array.isArray(data.items)?data.items:[];items.forEach(item=>{const id=String(item.id||item.listingId||"");if(missing.includes(id))records[id]=item;});write(KEYS.marketRecords,records);}catch(_){}
  }
  function loadFeed(){
    if(!feedPromise)feedPromise=fetch("./jobs-feed.json",{cache:"no-store"}).then(r=>r.ok?r.json():{items:[]}).then(d=>{savedFeed=Array.isArray(d.items)?d.items:[];return savedFeed;}).catch(()=>{savedFeed=[];return savedFeed;});
    return feedPromise;
  }
  function shops(){
    const snap=bridge()?.snapshot?.()||{},directory=Array.isArray(snap.directoryFavorites)?snap.directoryFavorites:[];
    const ids=readArray(KEYS.market),records=readMap(KEYS.marketRecords);
    const market=ids.map(id=>records[String(id)]).filter(Boolean).map(x=>({kind:"market",id:String(x.id||x.listingId||x.title||""),name:x.title||x.name||"إعلان محفوظ",category:x.category||"السوق",area:[x.area,x.village,x.district,x.governorate].filter(Boolean).join("، "),phone:x.phone||"",mapsUrl:x.mapsUrl||x.mapUrl||"",lat:x.latitude??x.lat??null,lon:x.longitude??x.lon??null}));
    return [...directory.map(x=>({...x,kind:"directory"})),...market];
  }
  function jobs(){
    const ids=new Set(readArray(KEYS.jobs).map(String)),records=readMap(KEYS.jobRecords),feed=new Map(savedFeed.map(x=>[jobKey(x),x]));
    return [...ids].map(id=>records[id]||feed.get(id)).filter(Boolean);
  }
  function counts(){return {shops:(bridge()?.snapshot?.().directoryFavorites?.length||0)+readArray(KEYS.market).length,jobs:readArray(KEYS.jobs).length};}
  function updateCount(){
    const c=counts(),n=c.shops+c.jobs;
    ["savedHubCount","profileSavedHubCount","profileFavsCount"].forEach(id=>{const x=$(id);if(x)x.textContent=String(n);});
    $("savedHubBtn")?.setAttribute("aria-label","المفضلة والمحفوظات، "+n);
  }
  function toast(message){
    if(typeof window.toast==="function"){window.toast(message);return;}
    let box=$("v3Toast");if(!box){box=node("div","","v3-toast");box.id="v3Toast";box.setAttribute("role","status");document.body.appendChild(box);}
    box.textContent=message;box.classList.add("show");clearTimeout(box.timer);box.timer=setTimeout(()=>box.classList.remove("show"),2200);
  }
  function extLink(label,url,cls){
    const href=safeUrl(url);if(!href)return null;const a=node("a",label,cls);a.href=href;
    if(href.startsWith("https:")){a.target="_blank";a.rel="noopener noreferrer";}return a;
  }
  function removeShop(item,source){
    window.dispatchEvent(new CustomEvent("dalilna:favorite-change",{detail:{kind:item.kind==="directory"?"directory":"marketplace",saved:false,key:item.id,item,source}}));
    if(item.kind==="directory")bridge()?.setDirectoryFavorite?.(item.id,false);
    else{write(KEYS.market,readArray(KEYS.market).filter(x=>String(x)!==String(item.id)));const m=readMap(KEYS.marketRecords);delete m[String(item.id)];write(KEYS.marketRecords,m);}
    updateCount();draw();
  }
  function removeJob(job,source){
    const key=jobKey(job);window.dispatchEvent(new CustomEvent("dalilna:favorite-change",{detail:{kind:"job",saved:false,key,item:job,source}}));
    write(KEYS.jobs,readArray(KEYS.jobs).filter(x=>String(x)!==key));
    const m=readMap(KEYS.jobRecords);delete m[key];write(KEYS.jobRecords,m);
    updateCount();draw();
  }
  function makeShop(item){
    const card=node("article","","v3-saved-card");card.append(node("h3",item.name),node("p",[item.category,item.area].filter(Boolean).join(" · "),"v3-saved-meta"));
    const actions=node("div","","v3-saved-actions");
    if(item.phone){const digits=String(item.phone).replace(/[^+\d]/g,"");const call=extLink("اتصال","tel:"+digits);const wa=extLink("واتساب","https://wa.me/"+digits.replace(/\D/g,""));if(call)actions.append(call);if(wa)actions.append(wa);}
    const map=item.mapsUrl||(item.lat!=null&&item.lon!=null?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(item.lat+","+item.lon):"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([item.name,item.area,"اليمن"].filter(Boolean).join(" ")));
    const mapLink=extLink("الخريطة",map);if(mapLink)actions.append(mapLink);
    const rm=node("button","إزالة","v3-remove");rm.type="button";rm.addEventListener("click",()=>removeShop(item,rm));actions.append(rm);card.append(actions);return card;
  }
  function makeJob(job){
    const card=node("article","","v3-saved-card");card.append(node("h3",job.title||"وظيفة محفوظة"),node("p",[job.organization,job.city||job.location,job.country,job.deadline].filter(Boolean).join(" · "),"v3-saved-meta"));
    const actions=node("div","","v3-saved-actions"),target=job.applicationUrl||job.url||job.sourceUrl;
    const apply=extLink(job.applicationUrl?"التقديم":"صفحة المصدر",target,"v3-job-apply");if(apply)actions.append(apply);
    const text=[job.title,job.organization,job.city||job.location,job.deadline].filter(Boolean).join(" · ");
    const share=extLink("مشاركة واتساب","https://wa.me/?text="+encodeURIComponent(text+" "+(safeUrl(target)||"")));if(share)actions.append(share);
    const rm=node("button","إزالة","v3-remove");rm.type="button";rm.addEventListener("click",()=>removeJob(job,rm));actions.append(rm);card.append(actions);return card;
  }
  function ensureDialog(){
    let dlg=$("savedHubDialog");if(dlg)return dlg;
    dlg=document.createElement("dialog");dlg.id="savedHubDialog";dlg.className="v3-saved-dialog";
    const body=node("div","","v3-saved-dialog-body"),head=node("div","","v3-saved-heading");
    head.appendChild(node("h2","مفضلتي ومحفوظاتي"));const close=node("button","×","v3-close");close.type="button";close.setAttribute("aria-label","إغلاق");close.addEventListener("click",()=>dlg.close());head.append(close);
    const tabs=node("div","","v3-saved-tabs");
    [["shops","المحلات والخدمات"],["jobs","الوظائف"]].forEach(([key,label])=>{const b=node("button",label);b.type="button";b.dataset.tab=key;b.addEventListener("click",()=>{tab=key;draw();});tabs.append(b);});
    const summary=node("div","","v3-saved-counts");summary.id="v3SavedCounts";const list=node("div","","v3-saved-list");list.id="v3SavedList";
    body.append(head,tabs,summary,list);dlg.append(body);document.body.append(dlg);return dlg;
  }
  function draw(){
    const dlg=ensureDialog(),list=$("v3SavedList"),c=counts();
    dlg.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tab===tab?"true":"false"));
    $("v3SavedCounts").textContent="المحلات والخدمات "+c.shops+" · الوظائف "+c.jobs+" · الإجمالي "+(c.shops+c.jobs);
    list.replaceChildren();const rows=tab==="jobs"?jobs().map(makeJob):shops().map(makeShop);
    if(!rows.length)list.append(node("p",tab==="jobs"?"لا توجد وظائف محفوظة حتى الآن.":"لا توجد محلات أو خدمات محفوظة حتى الآن.","v3-saved-empty"));
    else rows.forEach(x=>list.append(x));updateCount();
  }
  async function openHub(next="shops"){
    tab=next;await Promise.all([loadFeed(),loadMarketplaceSaved()]);draw();const dlg=ensureDialog();if(!dlg.open){if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","");}
  }
  function gate(){
    const dlg=$("accountDlg"),ready=bridge()?.snapshot?.().onboarded===true;
    if(dlg)dlg.classList.toggle("v3-gate",!ready);
    const desc=$("roleClientBtn")?.querySelector(".where");if(desc)desc.textContent="تصفح كزائر فوراً، وسجّل عند الحاجة لإضافة إعلان أو تقييم";
  }
  function roleButtons(){
    document.querySelectorAll("[data-v3-role]").forEach(b=>b.addEventListener("click",()=>{
      const role=b.dataset.v3Role,selector=role==="client"?"#roleClientBtn":role==="merchant"?"#roleMerchantBtn":"#roleAdminBtn";
      $(selector.slice(1))?.click();
    }));
  }
  function animate(detail){
    updateCount();const target=$("savedHubBtn"),source=detail?.source;if(!target)return;
    const glyph=detail?.kind==="job"?"★":"♥";
    if(!detail?.saved){
      if(source?.getBoundingClientRect){const r=source.getBoundingClientRect(),ghost=node("span",glyph,"v3-fly-item");ghost.style.left=r.left+"px";ghost.style.top=r.top+"px";document.body.append(ghost);ghost.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(.2)"}],{duration:250,easing:"ease-in",fill:"forwards"});setTimeout(()=>ghost.remove(),270);}
      target.classList.add("v3-pulse");setTimeout(()=>target.classList.remove("v3-pulse"),450);drawIfOpen();return;
    }
    if(!source?.getBoundingClientRect){target.classList.add("v3-pulse");setTimeout(()=>target.classList.remove("v3-pulse"),450);toast("تم الحفظ في مفضلتك");drawIfOpen();return;}
    const a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),ghost=node("span",glyph,"v3-fly-item");
    ghost.style.left=a.left+"px";ghost.style.top=a.top+"px";document.body.append(ghost);
    const dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2);
    const animation=ghost.animate([
      {transform:"translate3d(0,0,0) scale(1)",opacity:1,offset:0},
      {transform:"translate3d("+(dx*.52)+"px,"+(dy*.52-72)+"px,0) scale(1.15)",opacity:1,offset:.55,easing:"cubic-bezier(.22,.8,.25,1)"},
      {transform:"translate3d("+dx+"px,"+dy+"px,0) scale(.3)",opacity:0,offset:1}
    ],{duration:680,easing:"cubic-bezier(.22,.8,.25,1)",fill:"forwards"});
    animation.onfinish=()=>ghost.remove();target.classList.add("v3-pulse");setTimeout(()=>target.classList.remove("v3-pulse"),460);
    toast("تم الحفظ في مفضلتك");drawIfOpen();
  }
  function drawIfOpen(){if($("savedHubDialog")?.open)draw();}
  function bind(){
    $("savedHubBtn")?.addEventListener("click",()=>openHub("shops"));
    $("profileSavedHub")?.addEventListener("click",()=>openHub("shops"));
    roleButtons();updateCount();gate();
    const clientRole=$("roleClientBtn");if(clientRole&&!$("v3CustomerRegisterBtn")){const register=node("button","تسجيل الاسم ورقم الجوال","v3-customer-register");register.id="v3CustomerRegisterBtn";register.type="button";register.addEventListener("click",()=>customerGate(null));clientRole.insertAdjacentElement("afterend",register);}
    document.addEventListener("click",event=>{const action=event.target.closest("#navAdd,#addJob,#sqSell,#sqBuy,[data-rate-id]");if(!action)return;const role=bridge()?.snapshot?.().role||"client";if(role==="client"&&!customerProfile()){event.preventDefault();event.stopImmediatePropagation();customerGate(action);}},true);
    const dlg=$("accountDlg");if(dlg){new MutationObserver(gate).observe(dlg,{attributes:true,attributeFilter:["open"]});dlg.addEventListener("close",gate);}
    $("profileLogoutBtn")?.addEventListener("click",()=>setTimeout(()=>{gate();if(dlg&&!dlg.open)$("accountBtn")?.click();},100));
    window.addEventListener("dalilna:favorite-change",event=>{animate(event.detail||{});updateCount();});
    window.addEventListener("storage",updateCount);
    window.addEventListener("dalilna:languagechange",updateCount);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  window.DalilnaV3={openSavedHub:openHub,refreshSavedCounts:updateCount,refreshSavedHub:draw};
})();