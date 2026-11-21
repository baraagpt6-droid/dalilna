"use strict";
(function(){
 const API=window.DALILNA_API_BASE||"https://dalilna-live.onrender.com";
 const COUNTRIES=[["YE","اليمن"],["SA","السعودية"],["AE","الإمارات"],["OM","عُمان"],["QA","قطر"],["BH","البحرين"],["IQ","العراق"],["JO","الأردن"],["all","كل الدول"]];
 const COUNTRY_NAMES={YE:"Yemen",SA:"Saudi Arabia",AE:"United Arab Emirates",OM:"Oman",QA:"Qatar",BH:"Bahrain",IQ:"Iraq",JO:"Jordan"};
 const SOURCES={
  YE:[["YemenHR","https://yemenhr.com/"],["ReliefWeb","https://reliefweb.int/jobs?search=Yemen"],["وظائف الأمم المتحدة","https://careers.un.org/jobfeed?isPage=true"],["بيت.كوم اليمن","https://www.bayt.com/en/yemen/jobs/search/"]],
  SA:[["بيت.كوم","https://www.bayt.com/en/saudi-arabia/jobs/"],["Indeed","https://sa.indeed.com/jobs"],["GulfTalent","https://www.gulftalent.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=Saudi%20Arabia"]],
  AE:[["بيت.كوم","https://www.bayt.com/en/uae/jobs/"],["Indeed","https://ae.indeed.com/jobs"],["GulfTalent","https://www.gulftalent.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=United%20Arab%20Emirates"]],
  OM:[["بيت.كوم","https://www.bayt.com/en/oman/jobs/"],["Indeed","https://om.indeed.com/jobs"],["GulfTalent","https://www.gulftalent.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=Oman"]],
  QA:[["بيت.كوم","https://www.bayt.com/en/qatar/jobs/"],["Indeed","https://qa.indeed.com/jobs"],["GulfTalent","https://www.gulftalent.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=Qatar"]],
  BH:[["بيت.كوم","https://www.bayt.com/en/bahrain/jobs/"],["Indeed","https://bh.indeed.com/jobs"],["GulfTalent","https://www.gulftalent.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=Bahrain"]],
  IQ:[["بيت.كوم","https://www.bayt.com/en/iraq/jobs/"],["Indeed","https://iq.indeed.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=Iraq"]],
  JO:[["بيت.كوم","https://www.bayt.com/en/jordan/jobs/"],["Indeed","https://jo.indeed.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/search/?location=Jordan"]],
  all:[["Bayt","https://www.bayt.com/"],["GulfTalent","https://www.gulftalent.com/jobs"],["LinkedIn","https://www.linkedin.com/jobs/"],["ReliefWeb","https://reliefweb.int/jobs"]]
 };
 const TYPES=[["all","الكل"],["sale","للبيع"],["wanted","مطلوب"],["barter","مقايضة"],["free","مجاناً"]];
 const GROUPS=[["all","كل الأصناف"],["electronics","جوالات وإلكترونيات"],["vehicles","سيارات ودراجات"],["solar","منظومات طاقة شمسية"],["home","أثاث ومنزل"],["property","عقارات وأراضٍ"],["agriculture","مواشي وزراعة"],["tools","معدات وأدوات"],["clothing","ملابس وعطور"],["other","أشياء أخرى"]];
 let country="YE",transaction="all",group="all";
 const $=id=>document.getElementById(id);
 function el(tag,attrs,text){
  const node=document.createElement(tag);
  Object.keys(attrs||{}).forEach(key=>{
   if(key==="class")node.className=attrs[key];
   else if(key==="dataset")Object.assign(node.dataset,attrs[key]);
   else node.setAttribute(key,String(attrs[key]));
  });
  if(text!==undefined)node.textContent=text;
  return node;
 }
 function openDialog(dialog){
  if(dialog.showModal)dialog.showModal();
  else{dialog.setAttribute("open","");dialog.classList.add("dlg-fallback");document.body.classList.add("dialog-fallback-open");}
 }
 function closeDialog(dialog){
  if(dialog.close&&dialog.open)dialog.close();
  else{dialog.removeAttribute("open");dialog.classList.remove("dlg-fallback");document.body.classList.remove("dialog-fallback-open");}
 }
 function buildJobs(){
  const jobs=$("vJobs"),shared=$("sharedJobsPanel");
  if(jobs&&shared&&!$("jobsFeaturePanel")){
   const panel=el("section",{id:"jobsFeaturePanel",class:"jobs-feature-panel"});
   panel.innerHTML='<div class="feature-head"><h3>فرص عمل من مصادرها</h3><span class="tag">تحديث يومي</span></div><div class="country-tabs" id="jobsCountryTabs" aria-label="اختيار الدولة"></div><div class="job-source-links" id="jobSourceLinks"></div><div class="job-feed-status" id="jobsFeedStatus">جارٍ تحميل الوظائف من المصادر الخارجية…</div><div class="job-feed-list" id="jobsFeedCards"></div>';
   shared.parentNode.insertBefore(panel,shared);
   const seekers=el("section",{id:"jobSeekersPanel",class:"job-seekers-panel"});
   seekers.innerHTML='<div class="feature-head"><h3>باحثون عن عمل</h3><span class="tag">بموافقة أصحاب الملفات</span></div><div class="job-seeker-panel-actions"><button type="button" class="add" id="addJobSeeker">سجّل كباحث عن عمل</button><button type="button" class="ghost" id="refreshJobSeekers">تحديث القائمة</button></div><div class="job-seeker-status" id="jobSeekersStatus">جارٍ تحميل ملفات الباحثين عن عمل…</div><div class="job-seeker-list" id="jobSeekersList"></div>';
   $("jobs").parentNode.insertBefore(seekers,$("jobs"));
  }
  if(!$("jobSeekerDlg")){
   const dialog=el("dialog",{id:"jobSeekerDlg"});
   dialog.innerHTML='<form id="jobSeekerForm"><div class="feature-head"><h3>التسجيل كباحث عن عمل</h3><button type="button" class="x" id="closeJobSeeker">×</button></div><label>الاسم الكامل<input name="fullName" maxlength="100" required></label><label>التخصص أو المهنة<input name="specialty" maxlength="120" required placeholder="مثلاً: محاسب، مبرمج، فني كهرباء"></label><label>سنوات الخبرة<input name="experienceYears" type="number" min="0" max="60" step="1" required value="0"></label><label>الدولة<select name="country" required><option value="Yemen">اليمن</option><option value="Saudi Arabia">السعودية</option><option value="United Arab Emirates">الإمارات</option><option value="Oman">عُمان</option><option value="Qatar">قطر</option><option value="Bahrain">البحرين</option><option value="Iraq">العراق</option><option value="Jordan">الأردن</option></select></label><label>المحافظة أو المدينة<input name="governorate" maxlength="80" required></label><label>نبذة مختصرة<textarea name="bio" rows="3" maxlength="800" required placeholder="اكتب مهاراتك ونوع العمل الذي تبحث عنه"></textarea></label><label>رقم واتساب مع مفتاح الدولة<input name="whatsapp" type="tel" inputmode="tel" dir="ltr" maxlength="24" required placeholder="+9677xxxxxxxx"></label><label class="job-public-consent"><input name="consentPublic" type="checkbox" required><span>أوافق على نشر اسمي وتخصصي وخبرتي وموقعي ونبذتي ورقم واتسابي للعامة ليتمكن أصحاب العمل من التواصل معي مباشرة.</span></label><p class="job-seeker-status" id="jobSeekerFormStatus">الملف مجاني ويظل منشوراً 60 يوماً. لا تسجل إن لم توافق على إظهار بيانات التواصل.</p><div class="fbtn"><button class="add" type="submit">حفظ ونشر الملف</button></div></form>';
   document.body.appendChild(dialog);
  }
 }
 function buildSouq(){
  const panel=$("sharedSouqPanel");
  if(panel&&!$("souqFeatureWrap")){
   const wrap=el("div",{id:"souqFeatureWrap",class:"souq-feature-wrap"});
   wrap.innerHTML='<span class="feature-label">نوع العرض</span><div id="souqTransactionTabs" class="transaction-tabs"></div><span class="feature-label">الأصناف</span><div id="souqCategoryTabs" class="souq-category-tabs"></div>';
   const controls=panel.querySelector(".shared-marketplace-controls");
   panel.insertBefore(wrap,controls||panel.querySelector(".shared-marketplace-status"));
  }
 }
 function renderTabs(){
  const tabs=$("jobsCountryTabs");
  if(tabs){
   tabs.replaceChildren();
   COUNTRIES.forEach(pair=>{
    const button=el("button",{type:"button","aria-pressed":pair[0]===country?"true":"false"},pair[1]);
    button.dataset.country=pair[0];tabs.appendChild(button);
   });
  }
  const sourceLinks=$("jobSourceLinks");
  if(sourceLinks){
   sourceLinks.replaceChildren();
   (SOURCES[country]||SOURCES.all).forEach(pair=>sourceLinks.appendChild(el("a",{href:pair[1],target:"_blank",rel:"noopener noreferrer"},pair[0])));
  }
  const typeTabs=$("souqTransactionTabs");
  if(typeTabs){
   typeTabs.replaceChildren();
   TYPES.forEach(pair=>{
    const button=el("button",{type:"button","aria-pressed":pair[0]===transaction?"true":"false"},pair[1]);
    button.dataset.transaction=pair[0];typeTabs.appendChild(button);
   });
  }
  const groupTabs=$("souqCategoryTabs");
  if(groupTabs){
   groupTabs.replaceChildren();
   GROUPS.forEach(pair=>{
    const button=el("button",{type:"button","aria-pressed":pair[0]===group?"true":"false"},pair[1]);
    button.dataset.group=pair[0];groupTabs.appendChild(button);
   });
  }
 }
 function formatDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("ar",{year:"numeric",month:"short",day:"numeric"}).format(date);
 }
 async function loadJobs(){
  const status=$("jobsFeedStatus"),box=$("jobsFeedCards");
  if(!status||!box)return;
  status.textContent="جارٍ تحميل أحدث الوظائف…";box.replaceChildren();
  try{
   const response=await fetch(API+"/api/jobs?country="+encodeURIComponent(country)+"&limit=60",{cache:"no-store",headers:{Accept:"application/json"}});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
   if(!Array.isArray(data.items)||!data.items.length){
    status.textContent="لا توجد وظائف مطابقة في آخر مزامنة. استخدم روابط المنصات أعلاه للبحث المباشر.";
    return;
   }
   status.textContent="عدد الوظائف: "+data.items.length+" · آخر مزامنة: "+(formatDate(data.fetchedAt)||"غير متاح");
   data.items.forEach(job=>{
    const card=el("article",{class:"job-feed-card"});
    card.appendChild(el("h4",{},job.title||"وظيفة"));
    const meta=el("div",{class:"job-feed-meta"});
    [job.organization,job.city||job.location,job.country,formatDate(job.publishedAt),job.source].filter(Boolean).forEach(value=>meta.appendChild(el("span",{},String(value))));
    card.appendChild(meta);
    if(job.eligibility)card.appendChild(el("p",{},"شرط التقديم: "+job.eligibility));
    if(job.deadline)card.appendChild(el("p",{},"آخر موعد للتقديم: "+job.deadline));
    const actions=el("div",{class:"job-feed-actions"});
    if(job.url&&/^https?:\/\//i.test(job.url))actions.appendChild(el("a",{href:job.url,target:"_blank",rel:"noopener noreferrer"},"التقديم من المصدر"));
    card.appendChild(actions);box.appendChild(card);
   });
  }catch(error){status.textContent="تعذر تحميل الوظائف من الخادم. "+error.message;}
 }
 function waUrl(phone){
  const digits=String(phone||"").replace(/[^0-9]/g,"");
  return digits.length>=9&&digits.length<=15?"https://wa.me/"+digits:"";
 }
 async function loadCandidates(){
  const status=$("jobSeekersStatus"),box=$("jobSeekersList");
  if(!status||!box)return;
  status.textContent="جارٍ تحميل ملفات الباحثين…";box.replaceChildren();
  try{
   const countryName=COUNTRY_NAMES[country]||"all";
   const response=await fetch(API+"/api/jobs/candidates?country="+encodeURIComponent(countryName),{cache:"no-store",headers:{Accept:"application/json"}});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
   if(!Array.isArray(data.items)||!data.items.length){status.textContent="لا توجد ملفات منشورة لهذه الدولة حالياً.";return;}
   status.textContent="ملفات منشورة بموافقة أصحابها: "+data.items.length;
   data.items.forEach(person=>{
    const card=el("article",{class:"job-seeker-card"});
    card.appendChild(el("h4",{},person.fullName||"باحث عن عمل"));
    const experience=Number(person.experienceYears);
    card.appendChild(el("div",{class:"job-seeker-meta"},(person.specialty||"")+(experience===0?" · دون خبرة":" · "+experience+" سنة خبرة")));
    card.appendChild(el("div",{class:"job-seeker-meta"},[person.governorate,person.country].filter(Boolean).join(" · ")));
    if(person.bio)card.appendChild(el("p",{},person.bio));
    const href=waUrl(person.whatsapp);
    if(href){
     const actions=el("div",{class:"job-seeker-actions"});
     actions.appendChild(el("a",{href:href,target:"_blank",rel:"noopener noreferrer"},"تواصل واتساب"));
     card.appendChild(actions);
    }
    box.appendChild(card);
   });
  }catch(error){status.textContent="تعذر تحميل الباحثين عن عمل. "+error.message;}
 }
 async function submitCandidate(event){
  event.preventDefault();
  const form=$("jobSeekerForm"),status=$("jobSeekerFormStatus"),button=form.querySelector('[type="submit"]'),fd=new FormData(form);
  const payload={
   fullName:String(fd.get("fullName")||"").trim(),
   specialty:String(fd.get("specialty")||"").trim(),
   experienceYears:Number(fd.get("experienceYears")),
   country:String(fd.get("country")||""),
   governorate:String(fd.get("governorate")||"").trim(),
   bio:String(fd.get("bio")||"").trim(),
   whatsapp:String(fd.get("whatsapp")||"").trim(),
   consentPublic:fd.get("consentPublic")==="on"
  };
  if(!payload.consentPublic){status.textContent="يجب الموافقة على عرض معلوماتك قبل النشر.";return;}
  button.disabled=true;status.textContent="جارٍ إرسال ملفك إلى دليلنا…";
  try{
   const response=await fetch(API+"/api/jobs/candidates",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
   form.reset();closeDialog($("jobSeekerDlg"));
   const visible=$("jobSeekersStatus");if(visible)visible.textContent="تم نشر ملفك. سيبقى متاحاً لمدة 60 يوماً.";
   await loadCandidates();
  }catch(error){status.textContent="تعذر نشر الملف. "+error.message;}
  finally{button.disabled=false;}
 }
 function syncSearch(){
  const input=$("q");
  const filterActive=!!document.querySelector('#fltRow [data-flt][aria-pressed="true"]');
  const active=!!(input&&input.value.trim())||filterActive;
  document.body.classList.toggle("search-active",active);
  if(!active)document.body.classList.remove("quick-jump-reveal-emergency");
  const clear=$("clearSearch"),shouldHide=!(input&&input.value);
  if(clear&&clear.hidden!==shouldHide)clear.hidden=shouldHide;
 }
 function scrollToQuickTarget(id){
  const target=document.getElementById(id);
  if(!target)return;
  if(id==="emBox")document.body.classList.add("quick-jump-reveal-emergency");
  target.classList.remove("quick-jump-highlight");
  void target.offsetWidth;
  target.classList.add("quick-jump-highlight");
  target.scrollIntoView({behavior:"smooth",block:"center"});
  window.setTimeout(()=>target.classList.remove("quick-jump-highlight"),1100);
 }
 function scrollBackToSearch(){
  document.body.classList.remove("quick-jump-reveal-emergency");
  const target=document.querySelector(".search-bar")||document.getElementById("q");
  if(!target)return;
  target.classList.remove("quick-jump-highlight");
  void target.offsetWidth;
  target.classList.add("quick-jump-highlight");
  target.scrollIntoView({behavior:"smooth",block:"start"});
  window.setTimeout(()=>target.classList.remove("quick-jump-highlight"),1100);
 }
 function bind(){
  buildJobs();buildSouq();renderTabs();
  $("jobsCountryTabs")?.addEventListener("click",event=>{
   const button=event.target.closest("[data-country]");if(!button)return;
   country=button.dataset.country;renderTabs();loadJobs();loadCandidates();
  });
  $("souqTransactionTabs")?.addEventListener("click",event=>{
   const button=event.target.closest("[data-transaction]");if(!button)return;
   transaction=button.dataset.transaction;renderTabs();
   if(window.DalilnaShared&&typeof window.DalilnaShared.loadSouq==="function")window.DalilnaShared.loadSouq();
  });
  $("souqCategoryTabs")?.addEventListener("click",event=>{
   const button=event.target.closest("[data-group]");if(!button)return;
   group=button.dataset.group;renderTabs();
   if(window.DalilnaShared&&typeof window.DalilnaShared.loadSouq==="function")window.DalilnaShared.loadSouq();
  });
  $("addJobSeeker")?.addEventListener("click",()=>openDialog($("jobSeekerDlg")));
  $("closeJobSeeker")?.addEventListener("click",()=>closeDialog($("jobSeekerDlg")));
  $("jobSeekerForm")?.addEventListener("submit",submitCandidate);
  $("refreshJobSeekers")?.addEventListener("click",loadCandidates);
  $("q")?.addEventListener("input",syncSearch);
  $("clearSearch")?.addEventListener("click",()=>setTimeout(syncSearch,0));
  document.addEventListener("click",event=>{
   const jump=event.target.closest("[data-quick-jump]");
   if(jump){event.preventDefault();scrollToQuickTarget(jump.dataset.quickJump);}
   if(event.target.closest("#emBackToTop")){event.preventDefault();scrollBackToSearch();}
   if(event.target.closest("#tiles .tile,[data-flt]")){
    setTimeout(()=>{
     syncSearch();
     const top=document.getElementById("searchResultsTop");
     if(top&&!top.hidden)top.scrollIntoView({behavior:"smooth",block:"start"});
     else if(document.getElementById("vCat")&&!document.getElementById("vCat").hidden)document.getElementById("clist")?.scrollIntoView({behavior:"smooth",block:"start"});
    },180);
   }
   const share=event.target.closest("[data-share-id]");
   if(share){
    event.preventDefault();
    const item=share._item||{},textValue=[item.title,item.description,item.price,item.governorate].filter(Boolean).join(" · ");
    const url=location.href.split("?")[0]+"?item="+encodeURIComponent(item.id||"");
    if(navigator.share)navigator.share({title:item.title||"إعلان دليلنا",text:textValue,url:url}).catch(()=>{});
    else if(navigator.clipboard)navigator.clipboard.writeText(textValue+" "+url).then(()=>{share.textContent="تم النسخ";}).catch(()=>{});
   }
   const favorite=event.target.closest("[data-fav-id]");
   if(favorite){
    const key="dalilna-marketplace-favs-v1";let saved=[];
    try{saved=JSON.parse(localStorage.getItem(key)||"[]");}catch(_){}
    const id=favorite.dataset.favId,index=saved.indexOf(id);
    if(index>=0)saved.splice(index,1);else saved.push(id);
    try{localStorage.setItem(key,JSON.stringify(saved));}catch(_){}
    favorite.classList.toggle("is-favorite",index<0);
    favorite.setAttribute("aria-pressed",index<0?"true":"false");
    favorite.textContent=index<0?"★ مفضلة":"☆ مفضلة";
   }
  });
  const observer=new MutationObserver(syncSearch);
  // Watch filter state only. syncSearch also updates the clear button hidden state.
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["aria-pressed"]});
  loadJobs();loadCandidates();syncSearch();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
 window.DalilnaFeatures21={loadJobs:loadJobs,loadCandidates:loadCandidates};
})();
