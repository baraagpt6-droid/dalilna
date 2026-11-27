"use strict";
(function(){
 const API=window.DALILNA_API_BASE||"https://dalilna-live.onrender.com";
 const isEnglish=()=>String(window.DALILNA_LANGUAGE||document.documentElement.lang||"ar")==="en";
 const FEATURE_EN={
  "اليمن":"Yemen","السعودية":"Saudi Arabia","الإمارات":"United Arab Emirates","عُمان":"Oman","قطر":"Qatar","البحرين":"Bahrain","العراق":"Iraq","الأردن":"Jordan","كل الدول":"All countries","بيت.كوم اليمن":"Bayt.com Yemen","بيت.كوم":"Bayt.com","وظائف الأمم المتحدة":"UN Careers",
  "الكل":"All","للبيع":"For sale","مطلوب":"Wanted","مقايضة":"Barter","مجاناً":"Free","للإيجار":"For rent","كل الأصناف":"All categories","جوالات وإلكترونيات":"Phones and electronics","سيارات ودراجات وقطع غيار":"Cars, motorcycles and parts","عقارات وأراضٍ":"Property and land","طاقة شمسية وبطاريات":"Solar and batteries","أثاث وأجهزة منزلية":"Furniture and home appliances","مواشي وزراعة ومعدات":"Livestock, agriculture and equipment","ملابس وعطور ومستلزمات":"Clothing, perfumes and essentials",
  "فرص عمل من مصادرها":"Jobs from source providers","تحديث يومي":"Daily updates","باحثون عن عمل":"Job seekers","بموافقة أصحاب الملفات":"Published with profile-owner consent","سجّل كباحث عن عمل":"Register as a job seeker","التسجيل كباحث عن عمل":"Job seeker registration","الاسم الكامل":"Full name","التخصص أو المهنة":"Specialty or occupation","سنوات الخبرة":"Years of experience","الدولة":"Country","المحافظة أو المدينة":"Governorate or city","نبذة مختصرة":"Short bio","رقم واتساب مع مفتاح الدولة":"WhatsApp number with country code",
  "أوافق على نشر اسمي وتخصصي وخبرتي وموقعي ونبذتي ورقم واتسابي للعامة ليتمكن أصحاب العمل من التواصل معي مباشرة.":"I agree to publish my name, specialty, experience, location, bio and WhatsApp number so employers can contact me.",
  "الملف مجاني ويظل منشوراً 60 يوماً. لا تسجل إن لم توافق على إظهار بيانات التواصل.":"The profile is free and remains published for 60 days. Do not register unless you agree to show your contact details.",
  "حفظ ونشر الملف":"Save and publish profile","نوع العرض":"Listing type","الأصناف":"Categories","دون خبرة":"No experience","سنة خبرة":"years of experience","التقديم من المصدر":"Apply at provider","لا يتوفر رابط تقديم رسمي مباشر لهذا الإعلان":"No official direct application link is available","صفحة المصدر":"Source page","☆ حفظ":"☆ Save","★ محفوظة":"★ Saved","مشاركة":"Share","تواصل واتساب":"Contact on WhatsApp",
  "جارٍ تحميل أحدث الوظائف…":"Loading the latest jobs…","جارٍ تحميل ملفات الباحثين عن عمل…":"Loading job seeker profiles…","جارٍ تحميل ملفات الباحثين…":"Loading job seeker profiles…",
  "لا توجد وظائف مطابقة في آخر مزامنة. استخدم روابط المنصات أعلاه للبحث المباشر.":"No matching jobs in the latest sync. Use provider links above to search directly.",
  "لا توجد ملفات منشورة لهذه الدولة حالياً.":"No job seeker profiles are published for this country yet.","تم نشر ملفك. سيبقى متاحاً لمدة 60 يوماً.":"Your profile is published and will remain available for 60 days.","يجب الموافقة على عرض معلوماتك قبل النشر.":"You must consent to publishing your information before submitting.","جارٍ إرسال ملفك إلى دليلنا…":"Submitting your profile to Dalilna…","وظيفة":"Job","باحث عن عمل":"Job seeker",
  "مثلاً: محاسب، مبرمج، فني كهرباء":"e.g. accountant, programmer, electrician","اكتب مهاراتك ونوع العمل الذي تبحث عنه":"Describe your skills and the work you are seeking",
  "المؤهلات / الشروط: ":"Eligibility / requirements: ","آخر موعد للتقديم: ":"Application deadline: ","عدد الوظائف: ":"Jobs: ","ملفات منشورة بموافقة أصحابها: ":"Profiles published with consent: ","آخر مزامنة: ":"Last sync: ","غير متاح":"unavailable",
  "تعذر تحميل الوظائف الآن. حاول مرة أخرى بعد قليل.":"Could not load jobs right now. Please try again shortly.","تعذر تحميل الباحثين عن عمل الآن. حاول مرة أخرى بعد قليل.":"Could not load job seeker profiles right now. Please try again shortly.","تعذر نشر الملف الآن. تحقق من البيانات وحاول مرة أخرى.":"Could not submit the profile. Check the details and try again."
 };
 function translateFeatureTree(root=document.body){
  if(!root||typeof document.createTreeWalker!=="function")return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
   const parent=node.parentElement;if(!parent||parent.closest("script,style,textarea,pre,code,[data-no-translate]"))continue;
   if(!Object.prototype.hasOwnProperty.call(node,"__dalilnaFeatureOriginal"))node.__dalilnaFeatureOriginal=node.nodeValue;
   const original=String(node.__dalilnaFeatureOriginal||"");let translated=original;
   if(isEnglish()){
    const trimmed=original.trim();
    if(FEATURE_EN[trimmed])translated=original.replace(trimmed,FEATURE_EN[trimmed]);
    else for(const [ar,en] of Object.entries(FEATURE_EN))if(ar.endsWith(": ")&&translated.includes(ar))translated=translated.replace(ar,en);
   }
   node.nodeValue=translated;
  }
  const attrMap={"مثلاً: محاسب، مبرمج، فني كهرباء":"e.g. accountant, programmer, electrician","اكتب مهاراتك ونوع العمل الذي تبحث عنه":"Describe your skills and the work you are seeking"};
  for(const item of root.querySelectorAll?.("[placeholder],[aria-label],[title]")||[]){
   for(const attr of ["placeholder","aria-label","title"]){
    if(!item.hasAttribute(attr))continue;
    const marker="data-dalilna-feature-original-"+attr;
    if(!item.hasAttribute(marker))item.setAttribute(marker,item.getAttribute(attr)||"");
    const original=item.getAttribute(marker)||"";
    if(isEnglish()&&attrMap[original])item.setAttribute(attr,attrMap[original]);
    else if(!isEnglish())item.setAttribute(attr,original);
   }
  }
 }

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
 const TYPES=[["all","الكل"],["sale","للبيع"],["wanted","مطلوب"],["barter","مقايضة"],["free","مجاناً"],["rent","للإيجار"]];
 const GROUPS=[
  ["all","كل الأصناف"],
  ["electronics","جوالات وإلكترونيات"],
  ["vehicles","سيارات ودراجات وقطع غيار"],
  ["property","عقارات وأراضٍ"],
  ["solar","طاقة شمسية وبطاريات"],
  ["home","أثاث وأجهزة منزلية"],
  ["agriculture","مواشي وزراعة ومعدات"],
  ["clothing","ملابس وعطور ومستلزمات"]
 ];
 let country="YE",transaction="all",group="all",jobsSearchText="",jobsSavedOnly=false;
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
 const API_TIMEOUT_MS=12000;
 const API_RETRYABLE_GET_STATUSES=new Set([408,425,429,500,502,503,504]);
 const waitForApiRetry=delay=>new Promise(resolve=>window.setTimeout(resolve,delay));
 async function requestJobsApi(path,options={}){
  const method=String(options.method||"GET").toUpperCase();
  const retries=method==="GET"?1:0;
  for(let attempt=0;attempt<=retries;attempt++){
   const controller=new AbortController();
   let timedOut=false;
   const timer=window.setTimeout(()=>{timedOut=true;controller.abort();},API_TIMEOUT_MS);
   try{
    const response=await fetch(API+path,{cache:"no-store",...options,signal:controller.signal,
     headers:{Accept:"application/json",...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
     const error=new Error("request_failed");
     error.status=response.status;
     if(method==="GET"&&attempt<retries&&API_RETRYABLE_GET_STATUSES.has(response.status)){
      await waitForApiRetry(300*(attempt+1));continue;
     }
     throw error;
    }
    return data;
   }catch(error){
    const networkFailure=timedOut||error.name==="AbortError"||error instanceof TypeError;
    if(method==="GET"&&attempt<retries&&networkFailure){
     await waitForApiRetry(300*(attempt+1));continue;
    }
    if(timedOut){
     const timeoutError=new Error("request_timeout");
     timeoutError.code="DALILNA_JOBS_TIMEOUT";
     throw timeoutError;
    }
    throw error;
   }finally{window.clearTimeout(timer);}
  }
  throw new Error("request_failed");
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
   panel.innerHTML='<div class="feature-head"><h3>فرص عمل من مصادرها</h3><span class="tag">تحديث يومي</span></div><div class="country-tabs" id="jobsCountryTabs" aria-label="اختيار الدولة"></div><div class="jobs-feed-controls"><input type="search" id="jobsInlineSearch" autocomplete="off" placeholder="ابحث بالمسمى الوظيفي أو المدينة" aria-label="ابحث في الوظائف"><button type="button" id="jobsSavedFilter" aria-pressed="false">★ المحفوظة</button></div><div class="job-source-links" id="jobSourceLinks"></div><div class="job-feed-status" id="jobsFeedStatus"></div><div class="job-feed-list" id="jobsFeedCards"></div>';
   shared.parentNode.insertBefore(panel,shared);
   const seekers=el("section",{id:"jobSeekersPanel",class:"job-seekers-panel"});
   seekers.innerHTML='<div class="feature-head"><h3>باحثون عن عمل</h3><span class="tag">بموافقة أصحاب الملفات</span></div><div class="job-seeker-panel-actions"><button type="button" class="add" id="addJobSeeker">سجّل كباحث عن عمل</button></div><div class="job-seeker-status" id="jobSeekersStatus"></div><div class="job-seeker-list" id="jobSeekersList"></div>';
   $("jobs").parentNode.insertBefore(seekers,$("jobs"));
  }
  if(!$("jobSeekerDlg")){
   const dialog=el("dialog",{id:"jobSeekerDlg"});
   dialog.innerHTML='<form id="jobSeekerForm"><div class="feature-head"><h3>التسجيل كباحث عن عمل</h3><button type="button" class="x" id="closeJobSeeker">×</button></div><label>الاسم الكامل<input name="fullName" maxlength="100" required></label><label>التخصص أو المهنة<input name="specialty" maxlength="120" required placeholder="مثلاً: محاسب، مبرمج، فني كهرباء"></label><label>سنوات الخبرة<input name="experienceYears" type="number" min="0" max="60" step="1" required value="0"></label><label>الدولة<select name="country" required><option value="Yemen">اليمن</option><option value="Saudi Arabia">السعودية</option><option value="United Arab Emirates">الإمارات</option><option value="Oman">عُمان</option><option value="Qatar">قطر</option><option value="Bahrain">البحرين</option><option value="Iraq">العراق</option><option value="Jordan">الأردن</option></select></label><label>المحافظة أو المدينة<input name="governorate" maxlength="80" required></label><label>نبذة مختصرة<textarea name="bio" rows="3" maxlength="800" required placeholder="اكتب مهاراتك ونوع العمل الذي تبحث عنه"></textarea></label><label>رقم واتساب مع مفتاح الدولة<input name="whatsapp" type="tel" inputmode="tel" dir="ltr" maxlength="24" required placeholder="+9677xxxxxxxx"></label><label class="job-public-consent"><input name="consentPublic" type="checkbox" required><span>أوافق على نشر اسمي وتخصصي وخبرتي وموقعي ونبذتي ورقم واتسابي للعامة ليتمكن أصحاب العمل من التواصل معي مباشرة.</span></label><label class="job-public-consent"><input name="termsAccepted" type="checkbox" required><span>أوافق على <a href="./terms.html" target="_blank" rel="noopener noreferrer">شروط الاستخدام وسياسة المحتوى</a> وأؤكد أن بياناتي تخصني وأن نشرها لا ينتهك خصوصية الآخرين.</span></label><p class="job-seeker-status" id="jobSeekerFormStatus">الملف مجاني ويظل منشوراً 60 يوماً. لا تسجل إن لم توافق على إظهار بيانات التواصل.</p><div class="fbtn"><button class="add" type="submit">حفظ ونشر الملف</button></div></form>';
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
    const button=el("button",{type:"button","aria-pressed":pair[0]===country?"true":"false"},isEnglish()?(FEATURE_EN[pair[1]]||pair[1]):pair[1]);
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
    const button=el("button",{type:"button","aria-pressed":pair[0]===transaction?"true":"false"},isEnglish()?(FEATURE_EN[pair[1]]||pair[1]):pair[1]);
    button.dataset.transaction=pair[0];typeTabs.appendChild(button);
   });
  }
  const groupTabs=$("souqCategoryTabs");
  if(groupTabs){
   groupTabs.replaceChildren();
   GROUPS.forEach(pair=>{
    const button=el("button",{type:"button","aria-pressed":pair[0]===group?"true":"false"},isEnglish()?(FEATURE_EN[pair[1]]||pair[1]):pair[1]);
    button.dataset.group=pair[0];groupTabs.appendChild(button);
   });
  }
 }
 function formatDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat(isEnglish()?"en":"ar",{year:"numeric",month:"short",day:"numeric"}).format(date);
 }
 function safeJobUrl(value){
  try{const url=new URL(String(value||""));return url.protocol==="https:"?url.href:"";}catch(_){return "";}
 }
 function officialApplicationUrl(value){
  const href=safeJobUrl(value);if(!href)return "";
  const host=new URL(href).hostname.toLowerCase();
  const allowed=["yemenhr.com","reliefweb.int","bayt.com","careers.un.org","careers.sa"];
  return allowed.some(root=>host===root||host.endsWith("."+root))?href:"";
 }
 function readJobFavorites(){
  try{const value=JSON.parse(localStorage.getItem("dalilna-job-favs-v1")||"[]");return Array.isArray(value)?value:[];}catch(_){return [];}
 }
 function readJobFavoriteRecords(){try{const value=JSON.parse(localStorage.getItem("dalilna-job-favs-records-v1")||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}catch(_){return {};}}
 function jobFavoriteKey(job,sourceUrl){return String(job?.id||sourceUrl||job?.url||job?.title||"");}
 function normalizeJobSearch(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[أإآ]/g,"ا").replace(/[ى]/g,"ي").toLowerCase().replace(/[^\u0600-\u06FFa-z0-9]+/g," ").trim();}
 function applyJobFilters(){const query=normalizeJobSearch(jobsSearchText),saved=new Set(readJobFavorites()),box=$("jobsFeedCards");if(!box)return;let shown=0;box.querySelectorAll(".job-feed-card").forEach(card=>{const visible=(!query||normalizeJobSearch(card.textContent).includes(query))&&(!jobsSavedOnly||saved.has(card.dataset.favoriteKey||""));card.hidden=!visible;if(visible)shown++;});const filter=$("jobsSavedFilter");if(filter){filter.setAttribute("aria-pressed",jobsSavedOnly?"true":"false");filter.textContent=(isEnglish()?"★ Saved (":"★ المحفوظة (")+saved.size+")";}const status=$("jobsFeedStatus");if(status&&box.childElementCount)status.dataset.visibleCount=String(shown);}
 async function loadJobs(){
  const status=$("jobsFeedStatus"),box=$("jobsFeedCards");
  if(!status||!box)return;
  status.textContent="";
  try{
   const data=await requestJobsApi("/api/jobs?country="+encodeURIComponent(country)+"&limit=60");
   if(!Array.isArray(data.items)||!data.items.length){
    box.replaceChildren();
    status.textContent="لا توجد وظائف مطابقة في آخر مزامنة. استخدم روابط المنصات أعلاه للبحث المباشر.";
    translateFeatureTree(status);
    return;
   }
   status.textContent="عدد الوظائف: "+data.items.length+" · آخر مزامنة: "+(formatDate(data.fetchedAt)||"غير متاح");
   const fragment=document.createDocumentFragment();
   data.items.forEach(job=>{
    const card=el("article",{class:"job-feed-card"});
    card.appendChild(el("h4",{},job.title||"وظيفة"));
    const meta=el("div",{class:"job-feed-meta"});
    [job.organization,job.city||job.location,job.country,formatDate(job.publishedAt),job.source].filter(Boolean).forEach(value=>meta.appendChild(el("span",{},String(value))));
    card.appendChild(meta);
    const summary=String(job.summaryAr||job.summary||"").trim();
    if(summary)card.appendChild(el("p",{class:"job-feed-summary"},summary.slice(0,700)));
    if(job.eligibility)card.appendChild(el("p",{},"المؤهلات / الشروط: "+job.eligibility));
    if(job.deadline)card.appendChild(el("p",{},"آخر موعد للتقديم: "+job.deadline));
    const actions=el("div",{class:"job-feed-actions"});
    const direct=officialApplicationUrl(job.applicationUrl);
    const sourceUrl=safeJobUrl(job.url),key=jobFavoriteKey(job,sourceUrl),isSaved=new Set(readJobFavorites()).has(key);card.dataset.favoriteKey=key;
    if(direct)actions.appendChild(el("a",{href:direct,target:"_blank",rel:"noopener noreferrer",class:"job-apply-link"},"التقديم من المصدر"));
    else if(sourceUrl)actions.appendChild(el("span",{class:"job-apply-source-badge"},"التقديم عبر صفحة المصدر"));
    if(sourceUrl)actions.appendChild(el("a",{href:sourceUrl,target:"_blank",rel:"noopener noreferrer",class:"job-source-link"},"صفحة المصدر"));
    else if(!direct)actions.appendChild(el("span",{class:"job-feed-no-apply"},"رابط المصدر غير متاح"));
    const favorite=el("button",{type:"button","aria-pressed":isSaved?"true":"false","data-job-fav":key},isSaved?"★ محفوظة":"☆ حفظ");
    favorite.addEventListener("click",()=>{const items=new Set(readJobFavorites()),wasSaved=items.has(key);if(wasSaved)items.delete(key);else items.add(key);localStorage.setItem("dalilna-job-favs-v1",JSON.stringify([...items].slice(-300)));const records=readJobFavoriteRecords();if(wasSaved)delete records[key];else records[key]=job;localStorage.setItem("dalilna-job-favs-records-v1",JSON.stringify(records));favorite.setAttribute("aria-pressed",wasSaved?"false":"true");favorite.textContent=wasSaved?"☆ حفظ":"★ محفوظة";window.dispatchEvent(new CustomEvent("dalilna:favorite-change",{detail:{kind:"job",saved:!wasSaved,key,item:job,source:favorite}}));applyJobFilters();});
    actions.appendChild(favorite);
    const share=el("button",{type:"button"},"مشاركة");
    share.addEventListener("click",async()=>{
     const target=direct||sourceUrl;
     const payload={title:job.title||"وظيفة من دليلنا",text:[job.title,job.organization,job.city||job.location,job.deadline].filter(Boolean).join(" · "),url:target||location.href};
     try{if(navigator.share)await navigator.share(payload);else if(navigator.clipboard)await navigator.clipboard.writeText(payload.text+" "+payload.url);else throw new Error("share-unavailable");}
     catch(error){if(error.name!=="AbortError")toast("تعذرت المشاركة من هذا الجهاز.");}
    });
    actions.appendChild(share);
    card.appendChild(actions);fragment.appendChild(card);
   });
   box.replaceChildren(fragment);
   applyJobFilters();
   translateFeatureTree(box);
   translateFeatureTree(status.parentElement||status);
  }catch(_){if(!box.childElementCount){status.textContent="تعذر تحميل الوظائف الآن. حاول مرة أخرى بعد قليل.";translateFeatureTree(status);}}
 }
 function waUrl(phone){
  const digits=String(phone||"").replace(/[^0-9]/g,"");
  return digits.length>=9&&digits.length<=15?"https://wa.me/"+digits:"";
 }
 function normalizeBlockedSellerPhone(value){
  let digits=String(value||"").replace(/\D/g,"");
  if(digits.startsWith("00"))digits=digits.slice(2);
  if(digits.startsWith("967")&&digits.length===12)digits=digits.slice(3);
  if(digits.startsWith("0")&&digits.length===10)digits=digits.slice(1);
  return digits.length>=9&&digits.length<=15?digits:"";
 }
 function isBlockedJobSeeker(phone){
  const candidate=normalizeBlockedSellerPhone(phone);if(!candidate)return false;
  try{
   const list=JSON.parse(localStorage.getItem("dalilna-blocked-sellers-v1")||"[]");
   return Array.isArray(list)&&list.some(value=>normalizeBlockedSellerPhone(value)===candidate);
  }catch(_){return false;}
 }
 async function loadCandidates(){
  const status=$("jobSeekersStatus"),box=$("jobSeekersList");
  if(!status||!box)return;
  status.textContent="";
  try{
   const countryName=COUNTRY_NAMES[country]||"all";
   const data=await requestJobsApi("/api/jobs/candidates?country="+encodeURIComponent(countryName));
   if(!Array.isArray(data.items)||!data.items.length){box.replaceChildren();status.textContent="لا توجد ملفات منشورة لهذه الدولة حالياً.";translateFeatureTree(status);return;}
   const visibleItems=data.items.filter(person=>!isBlockedJobSeeker(person.whatsapp));
   if(!visibleItems.length){box.replaceChildren();status.textContent="لا توجد ملفات منشورة ظاهرة حالياً.";translateFeatureTree(status);return;}
   status.textContent="ملفات منشورة بموافقة أصحابها: "+visibleItems.length;
   const fragment=document.createDocumentFragment();
   visibleItems.forEach(person=>{
    const card=el("article",{class:"job-seeker-card"});
    card.appendChild(el("h4",{},person.fullName||"باحث عن عمل"));
    const experience=Number(person.experienceYears);
    card.appendChild(el("div",{class:"job-seeker-meta"},(person.specialty||"")+(experience===0?" · دون خبرة":" · "+experience+" سنة خبرة")));
    card.appendChild(el("div",{class:"job-seeker-meta"},[person.governorate,person.country].filter(Boolean).join(" · ")));
    if(person.bio)card.appendChild(el("p",{},person.bio));
    const actions=el("div",{class:"job-seeker-actions"});
    const report=el("button",{type:"button",class:"job-seeker-report"},"إبلاغ عن الملف");
    report.addEventListener("click",()=>window.DalilnaShared?.reportCandidate?.(person.id));
    actions.appendChild(report);
    const block=el("button",{type:"button",class:"job-seeker-block"},"حظر هذا الباحث");
    block.addEventListener("click",()=>window.DalilnaShared?.blockSeller?.(person.whatsapp));
    actions.appendChild(block);
    const href=waUrl(person.whatsapp);
    if(href)actions.appendChild(el("a",{href:href,target:"_blank",rel:"noopener noreferrer"},"تواصل واتساب"));
    card.appendChild(actions);
    fragment.appendChild(card);
   });
   box.replaceChildren(fragment);
   translateFeatureTree(box);
   translateFeatureTree(status.parentElement||status);
  }catch(_){if(!box.childElementCount){status.textContent="تعذر تحميل الباحثين عن عمل الآن. حاول مرة أخرى بعد قليل.";translateFeatureTree(status);}}
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
   consentPublic:fd.get("consentPublic")==="on",
   termsAccepted:fd.get("termsAccepted")==="on"
  };
  if(!payload.consentPublic||!payload.termsAccepted){status.textContent="يجب الموافقة على عرض معلوماتك وشروط المحتوى قبل النشر.";return;}
  button.disabled=true;status.textContent="جارٍ إرسال ملفك إلى دليلنا…";
  try{
   await requestJobsApi("/api/jobs/candidates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   form.reset();closeDialog($("jobSeekerDlg"));
   const visible=$("jobSeekersStatus");if(visible)visible.textContent="تم نشر ملفك. سيبقى متاحاً لمدة 60 يوماً.";
   await loadCandidates();
  }catch(_){status.textContent="تعذر نشر الملف الآن. تحقق من البيانات وحاول مرة أخرى.";}
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
  target.hidden=false;
  target.classList.remove("quick-jump-highlight");
  void target.offsetWidth;
  target.classList.add("quick-jump-highlight");
  target.scrollIntoView({behavior:"smooth",block:"start"});
  const header=document.querySelector("header");
  const headerOffset=header?Math.min(header.getBoundingClientRect().height,150):0;
  const targetTop=window.scrollY+target.getBoundingClientRect().top-headerOffset-10;
  if(Number.isFinite(targetTop)&&Math.abs(target.getBoundingClientRect().top-headerOffset)>24){
   window.setTimeout(()=>window.scrollTo({top:Math.max(0,targetTop),behavior:"smooth"}),80);
  }
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
  buildJobs();buildSouq();renderTabs();translateFeatureTree();
  window.addEventListener("dalilna:seller-block-change",()=>loadCandidates());
  $("jobsInlineSearch")?.addEventListener("input",event=>{jobsSearchText=event.target.value||"";applyJobFilters();});
  $("jobsSavedFilter")?.addEventListener("click",()=>{jobsSavedOnly=!jobsSavedOnly;applyJobFilters();});
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
  
  document.addEventListener("error",event=>{
   const image=event.target;
   if(!(image instanceof HTMLImageElement)||!image.classList.contains("shared-listing-image"))return;
   const fallback=document.createElement("div");fallback.className="shared-listing-image-fallback";
   fallback.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span>تعذر تحميل الصورة</span>';
   image.replaceWith(fallback);
  },true);
  document.querySelectorAll("[data-quick-jump]").forEach(jump=>{
   jump.addEventListener("click",event=>{event.preventDefault();scrollToQuickTarget(jump.dataset.quickJump);});
  });
  $("q")?.addEventListener("input",syncSearch);
  $("clearSearch")?.addEventListener("click",()=>setTimeout(syncSearch,0));
  document.addEventListener("click",event=>{
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
    const wasSaved=index>=0,item=favorite._item||null;
     try{const records=JSON.parse(localStorage.getItem("dalilna-marketplace-fav-records-v1")||"{}");if(wasSaved)delete records[id];else if(item)records[id]=item;localStorage.setItem("dalilna-marketplace-fav-records-v1",JSON.stringify(records));}catch(_){}
     window.dispatchEvent(new CustomEvent("dalilna:favorite-change",{detail:{kind:"marketplace",saved:!wasSaved,key:id,item,source:favorite}}));
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
 window.addEventListener("dalilna:languagechange",()=>{renderTabs();translateFeatureTree();loadJobs();loadCandidates();});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
 window.DalilnaFeatures21={loadJobs:loadJobs,loadCandidates:loadCandidates};
})();
