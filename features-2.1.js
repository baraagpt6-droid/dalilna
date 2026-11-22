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
 const COUNTRY_EN={YE:"Yemen",SA:"Saudi Arabia",AE:"United Arab Emirates",OM:"Oman",QA:"Qatar",BH:"Bahrain",IQ:"Iraq",JO:"Jordan",all:"All countries"};
 const TYPE_EN={all:"All",sale:"For sale",wanted:"Wanted",barter:"Barter",free:"Free",rent:"For rent"};
 const GROUP_EN={all:"All categories",electronics:"Phones and electronics",vehicles:"Cars, motorcycles and parts",property:"Property and land",solar:"Solar power and batteries",home:"Furniture and home appliances",agriculture:"Livestock, farming and equipment",clothing:"Clothing, perfumes and accessories"};
 const SOURCE_EN={"وظائف الأمم المتحدة":"UN Careers","بيت.كوم اليمن":"Bayt.com Yemen","بيت.كوم":"Bayt.com"};
 const TEXT_EN={
  "جارٍ تحميل أحدث الوظائف…":"Loading the latest jobs…","لا توجد وظائف مطابقة في آخر مزامنة. استخدم روابط المنصات أعلاه للبحث المباشر.":"No matching jobs in the latest sync. Use the source links above to search directly.",
  "عدد الوظائف: ":"Jobs: "," · آخر مزامنة: ":" · Last synced: ","غير متاح":"Unavailable","المؤهلات / الشروط: ":"Qualifications / requirements: ","آخر موعد للتقديم: ":"Application deadline: ",
  "التقديم من المصدر":"Apply at source","لا يتوفر رابط تقديم رسمي مباشر لهذا الإعلان":"No official direct application link is available for this advert","صفحة المصدر":"Source page","★ محفوظة":"★ Saved","☆ حفظ":"☆ Save",
  "مشاركة":"Share","تعذرت المشاركة من هذا الجهاز.":"Sharing is not available on this device.","تعذر تحميل الوظائف من الخادم. ":"Could not load jobs from the server.",
  "جارٍ تحميل ملفات الباحثين…":"Loading job seeker profiles…","لا توجد ملفات منشورة لهذه الدولة حالياً.":"There are no published profiles for this country yet.",
  "ملفات منشورة بموافقة أصحابها: ":"Profiles published with their owners' consent: ","دون خبرة":"No experience"," سنة خبرة":" years of experience",
  "تواصل واتساب":"Contact on WhatsApp","تعذر تحميل الباحثين عن عمل. ":"Could not load job seekers.",
  "يجب الموافقة على عرض معلوماتك قبل النشر.":"You must consent to showing your information before publishing.","جارٍ إرسال ملفك إلى دليلنا…":"Sending your profile to Dalilna…",
  "تم نشر ملفك. سيبقى متاحاً لمدة 60 يوماً.":"Your profile has been published and will remain available for 60 days.","تعذر نشر الملف. ":"Could not publish the profile.",
  "تعذر تحميل الصورة":"Image could not be loaded","إعلان":"Advert","إعلان دليلنا":"Dalilna advert","☆ مفضلة":"☆ Save","★ مفضلة":"★ Saved",
  "لا توجد صورة مرفقة":"No image attached","البائع: ":"Seller: ","أوقات العمل: ":"Opening hours: ","الموقع الإلكتروني":"Website","آخر موعد للتقديم: ":"Application deadline: ",
  "إعلان مجاني · مدة الصلاحية 60 يوماً":"Free advert · 60-day validity","إعلان مجاني · ينتهي ":"Free advert · Expires ",
  "واتساب البائع":"Seller WhatsApp","اتصال":"Call","عرض الخريطة":"View map","فتح الموقع في OpenStreetMap":"Open in OpenStreetMap",
  "جديد":"New","مستعمل":"Used","للبيع":"For sale","للإيجار":"For rent","مطلوب":"Wanted","مقايضة":"Barter","مجاني":"Free"
 };
 const isEnglish=()=>document.documentElement.lang==="en";
 const tr=value=>isEnglish()?(TEXT_EN[value]||value):value;
 function translateFeatureTree(root){
  if(!root)return;
  root.querySelectorAll("[data-ar][data-en]").forEach(node=>{node.textContent=isEnglish()?node.dataset.en:node.dataset.ar;});
  root.querySelectorAll("[data-placeholder-ar][data-placeholder-en]").forEach(node=>{node.placeholder=isEnglish()?node.dataset.placeholderEn:node.dataset.placeholderAr;});
 }
 function applyFeatureLanguage(){
  ["jobsFeaturePanel","jobSeekersPanel","souqFeatureWrap","jobSeekerDlg"].forEach(id=>translateFeatureTree($(id)));
  renderTabs();loadJobs();loadCandidates();
 }
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
   panel.innerHTML='<div class="feature-head"><h3 data-ar="فرص عمل من مصادرها" data-en="Jobs from their original sources">فرص عمل من مصادرها</h3><span class="tag" data-ar="تحديث يومي" data-en="Daily update">تحديث يومي</span></div><div class="country-tabs" id="jobsCountryTabs" aria-label="Country selection"></div><div class="job-source-links" id="jobSourceLinks"></div><div class="job-feed-status" id="jobsFeedStatus" data-ar="جارٍ تحميل الوظائف من المصادر الخارجية…" data-en="Loading jobs from external sources…">جارٍ تحميل الوظائف من المصادر الخارجية…</div><div class="job-feed-list" id="jobsFeedCards"></div>';
   shared.parentNode.insertBefore(panel,shared);
   const seekers=el("section",{id:"jobSeekersPanel",class:"job-seeker-panel"});
   seekers.innerHTML='<div class="feature-head"><h3 data-ar="باحثون عن عمل" data-en="Job seekers">باحثون عن عمل</h3><span class="tag" data-ar="بموافقة أصحاب الملفات" data-en="Published with owner consent">بموافقة أصحاب الملفات</span></div><div class="job-seeker-panel-actions"><button type="button" class="add" id="addJobSeeker" data-ar="سجّل كباحث عن عمل" data-en="Register as a job seeker">سجّل كباحث عن عمل</button></div><div class="job-seeker-status" id="jobSeekersStatus" data-ar="جارٍ تحميل ملفات الباحثين عن عمل…" data-en="Loading job seeker profiles…">جارٍ تحميل ملفات الباحثين عن عمل…</div><div class="job-seeker-list" id="jobSeekersList"></div>';
   $("jobs").parentNode.insertBefore(seekers,$("jobs"));
  }
  if(!$("jobSeekerDlg")){
   const dialog=el("dialog",{id:"jobSeekerDlg"});
   dialog.innerHTML='<form id="jobSeekerForm"><div class="feature-head"><h3 data-ar="التسجيل كباحث عن عمل" data-en="Register as a job seeker">التسجيل كباحث عن عمل</h3><button type="button" class="x" id="closeJobSeeker">×</button></div><label><span data-ar="الاسم الكامل" data-en="Full name">الاسم الكامل</span><input name="fullName" maxlength="100" required></label><label><span data-ar="التخصص أو المهنة" data-en="Specialty or occupation">التخصص أو المهنة</span><input name="specialty" maxlength="120" required placeholder="مثلاً: محاسب، مبرمج، فني كهرباء" data-placeholder-ar="مثلاً: محاسب، مبرمج، فني كهرباء" data-placeholder-en="e.g. accountant, programmer, electrician"></label><label><span data-ar="سنوات الخبرة" data-en="Years of experience">سنوات الخبرة</span><input name="experienceYears" type="number" min="0" max="60" step="1" required value="0"></label><label><span data-ar="الدولة" data-en="Country">الدولة</span><select name="country" required><option value="Yemen" data-ar="اليمن" data-en="Yemen">اليمن</option><option value="Saudi Arabia" data-ar="السعودية" data-en="Saudi Arabia">السعودية</option><option value="United Arab Emirates" data-ar="الإمارات" data-en="United Arab Emirates">الإمارات</option><option value="Oman" data-ar="عُمان" data-en="Oman">عُمان</option><option value="Qatar" data-ar="قطر" data-en="Qatar">قطر</option><option value="Bahrain" data-ar="البحرين" data-en="Bahrain">البحرين</option><option value="Iraq" data-ar="العراق" data-en="Iraq">العراق</option><option value="Jordan" data-ar="الأردن" data-en="Jordan">الأردن</option></select></label><label><span data-ar="المحافظة أو المدينة" data-en="Governorate or city">المحافظة أو المدينة</span><input name="governorate" maxlength="80" required></label><label><span data-ar="نبذة مختصرة" data-en="Short bio">نبذة مختصرة</span><textarea name="bio" rows="3" maxlength="800" required placeholder="اكتب مهاراتك ونوع العمل الذي تبحث عنه" data-placeholder-ar="اكتب مهاراتك ونوع العمل الذي تبحث عنه" data-placeholder-en="Describe your skills and the work you are looking for"></textarea></label><label><span data-ar="رقم واتساب مع مفتاح الدولة" data-en="WhatsApp number with country code">رقم واتساب مع مفتاح الدولة</span><input name="whatsapp" type="tel" inputmode="tel" dir="ltr" maxlength="24" required placeholder="+9677xxxxxxxx"></label><label class="job-public-consent"><input name="consentPublic" type="checkbox" required><span data-ar="أوافق على نشر اسمي وتخصصي وخبرتي وموقعي ونبذتي ورقم واتسابي للعامة ليتمكن أصحاب العمل من التواصل معي مباشرة." data-en="I agree to publish my name, specialty, experience, location, bio and WhatsApp number so employers can contact me.">أوافق على نشر اسمي وتخصصي وخبرتي وموقعي ونبذتي ورقم واتسابي للعامة ليتمكن أصحاب العمل من التواصل معي مباشرة.</span></label><p class="job-seeker-status" id="jobSeekerFormStatus" data-ar="الملف مجاني ويظل منشوراً 60 يوماً. لا تسجل إن لم توافق على إظهار بيانات التواصل." data-en="The profile is free and remains published for 60 days. Do not register unless you agree to show your contact details.">الملف مجاني ويظل منشوراً 60 يوماً. لا تسجل إن لم توافق على إظهار بيانات التواصل.</p><div class="fbtn"><button class="add" type="submit" data-ar="حفظ ونشر الملف" data-en="Save and publish profile">حفظ ونشر الملف</button></div></form>';
   document.body.appendChild(dialog);
  }
  translateFeatureTree($("jobsFeaturePanel"));translateFeatureTree($("jobSeekersPanel"));translateFeatureTree($("jobSeekerDlg"));
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
  if(tabs){tabs.replaceChildren();COUNTRIES.forEach(pair=>{const button=el("button",{type:"button","aria-pressed":pair[0]===country?"true":"false"},isEnglish()?(COUNTRY_EN[pair[0]]||pair[1]):pair[1]);button.dataset.country=pair[0];tabs.appendChild(button);});}
  const sourceLinks=$("jobSourceLinks");
  if(sourceLinks){sourceLinks.replaceChildren();(SOURCES[country]||SOURCES.all).forEach(pair=>sourceLinks.appendChild(el("a",{href:pair[1],target:"_blank",rel:"noopener noreferrer"},isEnglish()?(SOURCE_EN[pair[0]]||pair[0]):pair[0])));}
  const typeTabs=$("souqTransactionTabs");
  if(typeTabs){typeTabs.replaceChildren();TYPES.forEach(pair=>{const button=el("button",{type:"button","aria-pressed":pair[0]===transaction?"true":"false"},isEnglish()?(TYPE_EN[pair[0]]||pair[1]):pair[1]);button.dataset.transaction=pair[0];typeTabs.appendChild(button);});}
  const groupTabs=$("souqCategoryTabs");
  if(groupTabs){groupTabs.replaceChildren();GROUPS.forEach(pair=>{const button=el("button",{type:"button","aria-pressed":pair[0]===group?"true":"false"},isEnglish()?(GROUP_EN[pair[0]]||pair[1]):pair[1]);button.dataset.group=pair[0];groupTabs.appendChild(button);});}
 }
 function formatDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat(isEnglish()?"en-US":"ar",{year:"numeric",month:"short",day:"numeric"}).format(date);
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
 async function loadJobs(){
  const status=$("jobsFeedStatus"),box=$("jobsFeedCards");if(!status||!box)return;
  status.textContent=tr("جارٍ تحميل أحدث الوظائف…");box.replaceChildren();
  try{
   const response=await fetch(API+"/api/jobs?country="+encodeURIComponent(country)+"&limit=60",{cache:"no-store",headers:{Accept:"application/json"}});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
   if(!Array.isArray(data.items)||!data.items.length){status.textContent=tr("لا توجد وظائف مطابقة في آخر مزامنة. استخدم روابط المنصات أعلاه للبحث المباشر.");return;}
   status.textContent=tr("عدد الوظائف: ")+data.items.length+tr(" · آخر مزامنة: ")+(formatDate(data.fetchedAt)||tr("غير متاح"));
   data.items.forEach(job=>{
    const card=el("article",{class:"job-feed-card"});card.appendChild(el("h4",{},job.title||tr("وظيفة")));
    const meta=el("div",{class:"job-feed-meta"});[job.organization,job.city||job.location,job.country,formatDate(job.publishedAt),job.source].filter(Boolean).forEach(value=>meta.appendChild(el("span",{},String(value))));card.appendChild(meta);
    const summary=String(isEnglish()?(job.summary||job.summaryAr||""):(job.summaryAr||job.summary||"")).trim();if(summary)card.appendChild(el("p",{class:"job-feed-summary"},summary.slice(0,700)));
    if(job.eligibility)card.appendChild(el("p",{},tr("المؤهلات / الشروط: ")+job.eligibility));
    if(job.deadline)card.appendChild(el("p",{},tr("آخر موعد للتقديم: ")+job.deadline));
    const actions=el("div",{class:"job-feed-actions"}),direct=officialApplicationUrl(job.applicationUrl),sourceUrl=safeJobUrl(job.url);
    if(direct)actions.appendChild(el("a",{href:direct,target:"_blank",rel:"noopener noreferrer"},tr("التقديم من المصدر")));
    else actions.appendChild(el("span",{class:"job-feed-no-apply"},tr("لا يتوفر رابط تقديم رسمي مباشر لهذا الإعلان")));
    if(sourceUrl&&sourceUrl!==direct)actions.appendChild(el("a",{href:sourceUrl,target:"_blank",rel:"noopener noreferrer"},tr("صفحة المصدر")));
    const favoriteSet=new Set(readJobFavorites()),favorite=el("button",{type:"button","aria-pressed":favoriteSet.has(String(job.id))?"true":"false"},favoriteSet.has(String(job.id))?tr("★ محفوظة"):tr("☆ حفظ"));
    favorite.addEventListener("click",()=>{const items=new Set(readJobFavorites()),key=String(job.id||sourceUrl||job.title);if(items.has(key))items.delete(key);else items.add(key);try{localStorage.setItem("dalilna-job-favs-v1",JSON.stringify([...items].slice(-300)));}catch(_){}favorite.setAttribute("aria-pressed",items.has(key)?"true":"false");favorite.textContent=items.has(key)?tr("★ محفوظة"):tr("☆ حفظ");});
    actions.appendChild(favorite);
    const share=el("button",{type:"button"},tr("مشاركة"));
    share.addEventListener("click",async()=>{const target=direct||sourceUrl,payload={title:job.title||tr("وظيفة من دليلنا"),text:[job.title,job.organization,job.city||job.location,job.deadline].filter(Boolean).join(" · "),url:target||location.href};try{if(navigator.share)await navigator.share(payload);else if(navigator.clipboard)await navigator.clipboard.writeText(payload.text+" "+payload.url);else throw new Error("share-unavailable");}catch(error){if(error.name!=="AbortError")toast(tr("تعذرت المشاركة من هذا الجهاز."));}});
    actions.appendChild(share);card.appendChild(actions);box.appendChild(card);
   });
  }catch(error){status.textContent=tr("تعذر تحميل الوظائف من الخادم. ")+error.message;}
 }
 function waUrl(phone){
  const digits=String(phone||"").replace(/[^0-9]/g,"");
  return digits.length>=9&&digits.length<=15?"https://wa.me/"+digits:"";
 }
 async function loadCandidates(){
  const status=$("jobSeekersStatus"),box=$("jobSeekersList");if(!status||!box)return;
  status.textContent=tr("جارٍ تحميل ملفات الباحثين…");box.replaceChildren();
  try{
   const countryName=COUNTRY_NAMES[country]||"all";
   const response=await fetch(API+"/api/jobs/candidates?country="+encodeURIComponent(countryName),{cache:"no-store",headers:{Accept:"application/json"}});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
   if(!Array.isArray(data.items)||!data.items.length){status.textContent=tr("لا توجد ملفات منشورة لهذه الدولة حالياً.");return;}
   status.textContent=tr("ملفات منشورة بموافقة أصحابها: ")+data.items.length;
   data.items.forEach(person=>{
    const card=el("article",{class:"job-seeker-card"});card.appendChild(el("h4",{},person.fullName||tr("باحثون عن عمل")));
    const experience=Number(person.experienceYears);
    card.appendChild(el("div",{class:"job-seeker-meta"},(person.specialty||"")+(experience===0?" · "+tr("دون خبرة"):" · "+experience+tr(" سنة خبرة"))));
    card.appendChild(el("div",{class:"job-seeker-meta"},[person.governorate,person.country].filter(Boolean).join(" · ")));
    if(person.bio)card.appendChild(el("p",{},person.bio));
    const href=waUrl(person.whatsapp);if(href){const actions=el("div",{class:"job-seeker-actions"});actions.appendChild(el("a",{href:href,target:"_blank",rel:"noopener noreferrer"},tr("تواصل واتساب")));card.appendChild(actions);}
    box.appendChild(card);
   });
  }catch(error){status.textContent=tr("تعذر تحميل الباحثين عن عمل. ")+error.message;}
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
  if(!payload.consentPublic){status.textContent=tr("يجب الموافقة على عرض معلوماتك قبل النشر.");return;}
  button.disabled=true;status.textContent=tr("جارٍ إرسال ملفك إلى دليلنا…");
  try{
   const response=await fetch(API+"/api/jobs/candidates",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
   form.reset();closeDialog($("jobSeekerDlg"));
   const visible=$("jobSeekersStatus");if(visible)visible.textContent=tr("تم نشر ملفك. سيبقى متاحاً لمدة 60 يوماً.");
   await loadCandidates();
  }catch(error){status.textContent=tr("تعذر نشر الملف. ")+error.message;}
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
  buildJobs();buildSouq();renderTabs();
  window.addEventListener("dalilna:languagechange",applyFeatureLanguage);
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
