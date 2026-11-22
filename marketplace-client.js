"use strict";
(() => {
  const API = window.DALILNA_API_BASE || "https://dalilna-live.onrender.com";
  const $ = id => document.getElementById(id);
  const CATS = [
    ["grocery","بقالات"],["food","مطاعم ومخابز"],["cafe","بوفيات وكافيهات"],
    ["edu","مدارس وتعليم"],["health","مستشفيات ومراكز"],["pharmacy","صيدليات"],
    ["gov","جهات حكومية"],["money","بنوك وصرافة"],["jobs","وظائف"],
    ["land","أراضٍ وعقارات"],["build","مواد بناء"],["parts","قطع غيار"],
    ["craft","حرفيون وصيانة"],["transport","نقل ومواصلات"],["telecom","جوالات واتصالات"],
    ["utility","مياه وغاز"],["farm","زراعة ومواشٍ"],["mosque","مساجد"],["gold","ذهب ومجوهرات"],
    ["wedding","قاعات أعراس"],["hotel","فنادق وشقق"],["market","أسواق"],["solar","طاقة شمسية"],
    ["elec","إلكترونيات"],["clothes","ملابس وأحذية"],["home","أدوات منزلية"],["books","مكتبات"],
    ["beauty","عطور وتجميل"],["delivery","توصيل"],["salon","صالونات"],["laundry","مغاسل"],
    ["souq","سوق البيع والشراء"],["other","أخرى"]
  ];
  const PRODUCTS = [
    ["phone","جوال"],["phone_accessories","إكسسوارات جوال"],["watch","ساعة"],["computer","كمبيوتر / لابتوب"],["computer_accessories","ملحقات كمبيوتر"],["tablet","جهاز لوحي"],
    ["camera","كاميرا"],["car","سيارة"],["motorcycle","دراجة نارية"],["vehicle_parts","قطع غيار مركبات"],
    ["land","أرض"],["property","عقار"],["apartment","شقة"],["house","منزل"],["electronics","إلكترونيات"],["appliance","أجهزة منزلية"],
    ["furniture","أثاث"],["clothing","ملابس"],["shoes","أحذية"],["jewelry","ذهب ومجوهرات"],
    ["honey","عسل"],["coffee","بن وقهوة"],["spices","بهارات"],
    ["livestock","مواشٍ"],["agriculture","منتجات زراعية"],["building_materials","مواد بناء"],
    ["books","كتب"],["stationery","قرطاسية وأدوات مدرسية"],["perfume","عطور"],["cosmetics","مستحضرات تجميل"],
    ["solar_equipment","معدات طاقة شمسية"],["tools","أدوات ومعدات"],["household_items","مستلزمات منزلية"],
    ["kitchenware","أدوات مطبخ"],["baby_products","منتجات أطفال"],["games","ألعاب"],["sports_equipment","معدات رياضية"],
    ["animal_feed","أعلاف"],["seeds","بذور ومحاصيل"],["construction_equipment","معدات إنشاءات"],["other","أخرى"]
  ];
  const GOVS = ["أمانة العاصمة","صنعاء","عدن","تعز","إب","الحديدة","ذمار","البيضاء","لحج","أبين","الضالع","مأرب","الجوف","صعدة","حجة","عمران","المحويت","ريمة","حضرموت","شبوة","المهرة","سقطرى"];
  const CATS_EN={grocery:"Groceries",food:"Restaurants and bakeries",cafe:"Cafes",edu:"Education",health:"Hospitals and health centres",pharmacy:"Pharmacies",gov:"Government services",money:"Banks and exchange",jobs:"Jobs",land:"Property and land",build:"Building materials",parts:"Vehicle parts",craft:"Crafts and repair",transport:"Transport",telecom:"Mobile phones and telecom",utility:"Utilities",farm:"Agriculture and livestock",mosque:"Mosques",gold:"Gold and jewellery",wedding:"Wedding and event venues",hotel:"Hotels and apartments",market:"Markets",solar:"Solar power and batteries",elec:"Electronics and computers",clothes:"Clothing and shoes",home:"Furniture and home appliances",books:"Books and stationery",beauty:"Perfumes and beauty",delivery:"Delivery and courier services",salon:"Hairdressers and salons",laundry:"Laundry",souq:"Buy and sell marketplace",other:"Other"};
  const PRODUCTS_EN={phone:"Mobile phone",phone_accessories:"Phone accessories",watch:"Watch",computer:"Computer / laptop",computer_accessories:"Computer accessories",tablet:"Tablet",camera:"Camera",car:"Car",motorcycle:"Motorcycle",vehicle_parts:"Vehicle parts",land:"Land",property:"Property",apartment:"Apartment",house:"House",electronics:"Electronics",appliance:"Home appliance",furniture:"Furniture",clothing:"Clothing",shoes:"Shoes",jewelry:"Gold and jewellery",honey:"Honey",coffee:"Coffee",spices:"Spices",livestock:"Livestock",agriculture:"Agricultural products",building_materials:"Building materials",books:"Books",stationery:"Stationery",perfume:"Perfumes",cosmetics:"Cosmetics",solar_equipment:"Solar equipment",tools:"Tools and equipment",household_items:"Household items",kitchenware:"Kitchenware",baby_products:"Baby products",games:"Toys",sports_equipment:"Sports equipment",animal_feed:"Animal feed",seeds:"Seeds and crops",construction_equipment:"Construction equipment",other:"Other"};
  const GOV_EN={"أمانة العاصمة":"Amanat Al Asimah","صنعاء":"Sana'a","عدن":"Aden","تعز":"Taiz","إب":"Ibb","الحديدة":"Al Hudaydah","ذمار":"Dhamar","البيضاء":"Al Bayda","لحج":"Lahij","أبين":"Abyan","الضالع":"Al Dhale'e","مأرب":"Marib","الجوف":"Al Jawf","صعدة":"Sa'dah","حجة":"Hajjah","عمران":"Amran","المحويت":"Al Mahwit","ريمة":"Raymah","حضرموت":"Hadramaut","شبوة":"Shabwah","المهرة":"Al Mahrah","سقطرى":"Socotra"};
  const EN_TEXT={
   "كل الأقسام":"All categories","كل المحافظات":"All governorates","البائع: ":"Seller: ","إعلان":"Advert","إعلان دليلنا":"Dalilna advert","لا توجد صورة مرفقة":"No image attached",
   "جديد":"New","مستعمل":"Used","للبيع":"For sale","للإيجار":"For rent","مطلوب":"Wanted","مقايضة":"Barter","مجاني":"Free",
   "أوقات العمل: ":"Opening hours: ","الموقع الإلكتروني":"Website","آخر موعد للتقديم: ":"Application deadline: ","واتساب البائع":"Seller WhatsApp","اتصال":"Call",
   "عرض الخريطة":"View map","فتح الموقع في OpenStreetMap":"Open in OpenStreetMap","إعلان مجاني · مدة الصلاحية 60 يوماً":"Free advert · 60-day validity",
   "إعلان مجاني · ينتهي ":"Free advert · Expires ","مشاركة":"Share","مفضلة":"Saved","لا توجد إعلانات مرفقة":"No adverts attached",
   "جارٍ تحميل الإعلانات المعتمدة من قاعدة البيانات المشتركة…":"Loading approved adverts from the shared database…",
   "يعرض ":"Showing "," من ":" of "," إعلاناً منشوراً · آخر تحديث ":" published listings · Last updated ",
   tr("خدمة البيانات المشتركة لم تُفعّل بعد. سيظهر المحتوى هنا بعد ربط قاعدة البيانات."):"The shared data service is not enabled yet. Listings will appear after the database is connected.",
   "تعذر تحميل الإعلانات المشتركة. ":"Could not load shared adverts. ","واجهة السوق المشترك جاهزة، وتنتظر تهيئة قاعدة PostgreSQL.":"The shared marketplace is ready and waiting for PostgreSQL setup.",
   "تم استلام الإعلان. سيظهر لجميع المستخدمين بعد موافقة الإدارة.":"Your advert was received. It will appear to users after administrator approval.",
   "هذا الإعلان سبق إرساله للمراجعة.":"This advert has already been submitted for review.",
   "تم اعتماد الإعلان ونشره للجميع.":"The advert was approved and published.",
   "تم رفض الإعلان.":"The advert was rejected.","تعذرت مراجعة الإعلان: ":"Could not review the advert: ",
   "جارٍ تحميل طلبات المراجعة…":"Loading review requests…","لا توجد إعلانات تنتظر المراجعة.":"No adverts are waiting for review.",
   "طلبات تنتظر المراجعة: ":"Pending review requests: ","موافقة ونشر":"Approve and publish","رفض":"Reject",
   "تعذر تحميل الطلبات. ":"Could not load review requests. ","لم نتمكن من قراءة الإضافات المحلية القديمة.":"Could not read older local submissions.",
   "لا توجد إضافات محلية لنقلها.":"There are no local submissions to move.","تم إرسال ":"Submitted ",
   " إدخالاً للمراجعة":" records for review","، وتعذر إرسال ":"; could not submit ","تم النسخ":"Copied",
   "تعذر تحميل الصورة":"Image could not be loaded"
  };
  const isEnglish=()=>document.documentElement.lang==="en";
  const tr=(value)=>isEnglish()?(EN_TEXT[value]||value):value;
  const categoryLabel=(id,fallback)=>isEnglish()?(CATS_EN[id]||fallback||id):(fallback||id);
  const productLabel=(id,fallback)=>isEnglish()?(PRODUCTS_EN[id]||fallback||id):(fallback||id);
  const placeLabel=value=>isEnglish()?(GOV_EN[value]||value):value;
  const numberLabel=value=>Number(value||0).toLocaleString(isEnglish()?"en-US":"ar-YE");
  let adminToken = "";
  let loadTimer = null;

  function flash(message) {
    const toast = $("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 3800);
    } else {
      window.alert(message);
    }
  }
  async function api(path, options) {
    const response = await fetch(API + path, {
      cache: "no-store",
      ...options,
      headers: { Accept: "application/json", ...(options && options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || ("HTTP " + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function fillSelect(select, entries, allText) {
    if (!select) return;
    const old = select.value;
    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = allText;
    select.appendChild(all);
    entries.forEach(pair => {
      const option = document.createElement("option");
      option.value = pair[0];
      option.textContent = CATS_EN[pair[0]]&&isEnglish()?CATS_EN[pair[0]]:(GOV_EN[pair[0]]&&isEnglish()?GOV_EN[pair[0]]:pair[1]);
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === old)) select.value = old;
  }
  function makeCard(item) {
    const card = document.createElement("article");
    card.className = "shared-listing-card";
    if (typeof item.imageData === "string" && item.imageData.length <= 400000 && /^data:image\/(?:jpeg|png|webp);base64,/.test(item.imageData)) {
      const img = document.createElement("img");
      img.className = "shared-listing-image";
      img.src = item.imageData;
      img.alt = item.title || tr("إعلان");
      img.loading = "lazy";
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "shared-listing-image-fallback no-image";
      placeholder.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span>'+tr("لا توجد صورة مرفقة")+'</span>';
      card.appendChild(placeholder);
    }
    const title = document.createElement("h3");
    title.textContent = item.title || tr("إعلان");
    card.appendChild(title);
    if (item.sellerName) {
      const seller = document.createElement("p");
      seller.className = "shared-listing-meta";
      seller.textContent = tr("البائع: ") + item.sellerName;
      card.appendChild(seller);
    }
    const tags = document.createElement("div");
    tags.className = "shared-listing-tags";
    const category = CATS.find(x => x[0] === item.category);
    const product = PRODUCTS.find(x => x[0] === item.productType);
    const labels = [category ? categoryLabel(item.category,category[1]) : categoryLabel(item.category,item.category)];
    if (item.category === "souq" || item.category === "land") labels.push(product ? productLabel(item.productType,product[1]) : (isEnglish()?"Other product":"منتج آخر"));
    if (item.condition === "new") labels.push(tr("جديد"));
    if (item.condition === "used") labels.push(tr("مستعمل"));
    if (item.listingType === "sale") labels.push(tr("للبيع"));
    if (item.listingType === "rent") labels.push(tr("للإيجار"));
    if (item.listingType === "wanted") labels.push(tr("مطلوب"));
    if (item.listingType === "barter") labels.push(tr("مقايضة"));
    if (item.listingType === "free") labels.push(tr("مجاني"));
    labels.forEach(label => {
      const tag = document.createElement("span");
      tag.textContent = label;
      tags.appendChild(tag);
    });
    card.appendChild(tags);
    const place = [item.area,item.district,item.governorate].filter(Boolean).join(" · ");
    if (place) {
      const p = document.createElement("p");
      p.className = "shared-listing-place";
      p.textContent = place.split(" · ").map(placeLabel).join(" · ");
      card.appendChild(p);
    }
    if (item.price) {
      const price = document.createElement("p");
      price.className = "shared-listing-price";
      price.textContent = item.price + (item.currency ? " " + item.currency : "");
      card.appendChild(price);
    }
    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "shared-listing-description";
      desc.textContent = item.description;
      card.appendChild(desc);
    }
    if (item.openingHours) {
      const hours = document.createElement("p");
      hours.className = "shared-listing-meta";
      hours.textContent = tr("أوقات العمل: ") + item.openingHours;
      card.appendChild(hours);
    }
    if (item.website) {
      const website = document.createElement("a");
      website.href = item.website;
      website.target = "_blank";
      website.rel = "noopener noreferrer";
      website.textContent = tr("الموقع الإلكتروني");
      card.appendChild(website);
    }
    if (item.category === "jobs" && item.deadline) {
      const deadline = document.createElement("p");
      deadline.className = "shared-listing-meta";
      deadline.textContent = tr("آخر موعد للتقديم: ") + item.deadline;
      card.appendChild(deadline);
    }
    const actions = document.createElement("div");
    actions.className = "shared-listing-actions";
    if (item.phone) {
      const phoneDigits = String(item.phone).replace(/[^0-9]/g, "");
      if (phoneDigits.length >= 9 && phoneDigits.length <= 15) {
        const wa = document.createElement("a");
        wa.href = "https://wa.me/" + phoneDigits + "?text=" + encodeURIComponent("مرحباً، وجدت إعلانكم في دليلنا وأريد الاستفسار.");
        wa.target = "_blank"; wa.rel = "noopener noreferrer"; wa.textContent = tr("واتساب البائع"); actions.appendChild(wa);
      }
      const tel = document.createElement("a");
      tel.href = "tel:" + String(item.phone).replace(/[^0-9+]/g, "");
      tel.textContent = tr("اتصال"); actions.appendChild(tel);
    }
    let mapElement = null;
    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      const mapButton = document.createElement("button");
      mapButton.type = "button"; mapButton.dataset.mapToggle = "1";
      mapButton.dataset.lat = String(item.latitude); mapButton.dataset.lon = String(item.longitude);
      mapButton.dataset.title = item.title || "موقع الإعلان"; mapButton.textContent = tr("عرض الخريطة");
      actions.appendChild(mapButton);
      mapElement = document.createElement("div"); mapElement.className = "dalilna-map"; mapElement.hidden = true;
    } else if (place) {
      const map = document.createElement("a");
      map.href = "https://www.openstreetmap.org/search?query=" + encodeURIComponent([item.title,place,"اليمن"].join(" "));
      map.target = "_blank"; map.rel = "noopener noreferrer"; map.textContent = tr("فتح الموقع في OpenStreetMap"); actions.appendChild(map);
    }
    if (item.category === "souq" || item.category === "land") {
      const expiry = document.createElement("p"); expiry.className = "shared-listing-expiry";
      const expiryDate = item.expiresAt ? new Date(item.expiresAt) : null;
      expiry.textContent = !expiryDate || Number.isNaN(expiryDate.getTime()) ? tr("إعلان مجاني · مدة الصلاحية 60 يوماً") : tr("إعلان مجاني · ينتهي ") + expiryDate.toLocaleDateString(isEnglish()?"en-US":"ar");
      card.appendChild(expiry);
    }
    if (item.category === "souq" || item.category === "land") {
      const share = document.createElement("button"); share.type = "button"; share.dataset.shareId = item.id; share.textContent = tr("مشاركة"); share._item = item; actions.appendChild(share);
      let favs = []; try { favs = JSON.parse(localStorage.getItem("dalilna-marketplace-favs-v1") || "[]"); } catch (_) {}
      const favorite = document.createElement("button"); favorite.type = "button"; favorite.dataset.favId = item.id;
      favorite.setAttribute("aria-pressed",favs.includes(item.id)?"true":"false"); favorite.className = favs.includes(item.id)?"is-favorite":""; favorite.textContent = favs.includes(item.id)?tr("★ مفضلة"):tr("☆ مفضلة"); actions.appendChild(favorite);
    }
    card.appendChild(actions);
    if (mapElement) card.appendChild(mapElement);
    return card;
  }
  async function loadList(filters, statusId, listId) {
    const status = $(statusId), list = $(listId);
    if (!list || !status) return;
    status.textContent = tr("جارٍ تحميل الإعلانات المعتمدة من قاعدة البيانات المشتركة…");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key,value]) => { if (value && value !== "all") params.set(key,value); });
    params.set("limit","12");
    params.set("includeImages","1");
    try {
      const result = await api("/api/marketplace/listings?" + params.toString());
      list.replaceChildren();
      (result.items || []).forEach(item => list.appendChild(makeCard(item)));
      status.textContent = result.count
        ? tr("يعرض ") + numberLabel(result.items.length) + tr(" من ") + numberLabel(result.count) + tr(" إعلاناً منشوراً · آخر تحديث ") + new Date(result.fetchedAt).toLocaleTimeString(isEnglish()?"en-US":"ar")
        : "";
      return result;
    } catch (e) {
      list.replaceChildren();
      status.textContent = e.status === 503
        ? "خدمة البيانات المشتركة لم تُفعّل بعد. سيظهر المحتوى هنا بعد ربط قاعدة البيانات."
        : tr("تعذر تحميل الإعلانات المشتركة. ") + e.message;
      return null;
    }
  }
  function loadHome() {
    return loadList({
      q: $("sharedDirectoryQuery") && $("sharedDirectoryQuery").value.trim(),
      category: $("sharedDirectoryCategory") && $("sharedDirectoryCategory").value,
      governorate: $("sharedDirectoryGovernorate") && $("sharedDirectoryGovernorate").value,
      district: $("sharedDirectoryDistrict") && $("sharedDirectoryDistrict").value.trim()
    }, "sharedDirectoryStatus", "sharedDirectoryItems");
  }
  async function loadSouq() {
    const selectedType = document.querySelector("#souqTransactionTabs [aria-pressed=true]");
    const selectedGroup = document.querySelector("#souqCategoryTabs [aria-pressed=true]");
    return loadList({
      category: "marketplace",
      listingType: selectedType && selectedType.dataset.transaction !== "all" ? selectedType.dataset.transaction : "",
      productGroup: selectedGroup && selectedGroup.dataset.group !== "all" ? selectedGroup.dataset.group : "",
      governorate: $("sharedSouqGovernorate") && $("sharedSouqGovernorate").value
    }, "sharedSouqStatus", "sharedSouqItems");
  }
  function loadJobs() {
    return loadList({ category: "jobs" }, "sharedJobsStatus", "sharedJobsItems");
  }
  async function submitListing(item) {
    const payload = {
      clientRef: item.id,
      title: item.name,
      category: item.cat,
      productType: item.productType || "other",
      listingType: item.listingType || "sale",
      condition: item.condition || "unknown",
      governorate: item.gov,
      district: item.dist,
      area: item.area,
      village: item.village,
      country: item.country || "اليمن",
      description: item.desc,
      phone: item.phone,
      openingHours: item.hours || item.openingHours || "",
      website: item.website || "",
      sellerName: item.ownerName || "",
      price: item.price,
      currency: item.currency || "YER",
      imageData: item.img || "",
      latitude: item.lat,
      longitude: item.lng,
      deadline: item.deadline || ""
    };
    try {
      const result = await api("/api/marketplace/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      flash(result.duplicate ? "هذا الإعلان سبق إرساله للمراجعة." : "تم استلام الإعلان. سيظهر لجميع المستخدمين بعد موافقة الإدارة.");
    } catch (e) {
      flash("حُفظ الإعلان على هذا الجهاز، لكن تعذرت مزامنته: " + e.message);
    }
  }
  async function review(id, decision, note) {
    try {
      await api("/api/marketplace/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken },
        body: JSON.stringify({ id, decision, note })
      });
      flash(decision === "approve" ? "تم اعتماد الإعلان ونشره للجميع." : "تم رفض الإعلان.");
      await loadAdminQueue();
      await Promise.all([loadHome(),loadSouq(),loadJobs()]);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        adminToken = "";
        window.sessionStorage.removeItem("dalilna-shared-admin-token");
      }
      flash("تعذرت مراجعة الإعلان: " + e.message);
    }
  }
  async function loadAdminQueue() {
    const status = $("sharedAdminStatus"), box = $("sharedAdminQueue");
    if (!status || !box) return;
    if (!adminToken) {
      adminToken = window.sessionStorage.getItem("dalilna-shared-admin-token") || "";
      if (!adminToken) {
        const token = window.prompt("أدخل رمز إدارة الخادم DALILNA_ADMIN_TOKEN.");
        if (!token) return;
        adminToken = token.trim();
        window.sessionStorage.setItem("dalilna-shared-admin-token",adminToken);
      }
    }
    status.textContent = "جارٍ تحميل طلبات المراجعة…";
    box.replaceChildren();
    try {
      const result = await api("/api/marketplace/admin/pending", {
        headers: { Authorization: "Bearer " + adminToken }
      });
      if (!result.items || !result.items.length) {
        status.textContent = "لا توجد إعلانات تنتظر المراجعة.";
        return;
      }
      status.textContent = "طلبات تنتظر المراجعة: " + result.items.length;
      result.items.forEach(item => {
        const row = makeCard(item);
        row.classList.add("shared-admin-item");
        const note = document.createElement("textarea");
        note.maxLength = 500;
        note.placeholder = "ملاحظة للمراجعة (اختياري)";
        const actions = document.createElement("div");
        actions.className = "shared-listing-actions";
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "shared-approve";
        approve.textContent = "موافقة ونشر";
        approve.addEventListener("click", () => review(item.id,"approve",note.value));
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "shared-reject";
        reject.textContent = "رفض";
        reject.addEventListener("click", () => review(item.id,"reject",note.value));
        actions.append(approve,reject);
        row.append(note,actions);
        box.appendChild(row);
      });
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        adminToken = "";
        window.sessionStorage.removeItem("dalilna-shared-admin-token");
      }
      status.textContent = "تعذر تحميل الطلبات. " + e.message;
    }
  }
  async function migrateLocal() {
    const bridge = window.DalilnaMarketplaceBridge;
    if (!bridge || typeof bridge.exportLocalListings !== "function") {
      flash("لم نتمكن من قراءة الإضافات المحلية القديمة.");
      return;
    }
    const items = bridge.exportLocalListings();
    if (!items.length) {
      flash("لا توجد إضافات محلية لنقلها.");
      return;
    }
    if (!window.confirm("سيتم إرسال " + items.length + " إدخالاً من هذا الجهاز إلى صندوق مراجعة الإدارة. لن تُنشر قبل الموافقة. هل تريد المتابعة؟")) return;
    let done = 0, failed = 0;
    for (const item of items) {
      try {
        await api("/api/marketplace/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientRef: item.id, title: item.name, category: item.cat,
            productType: item.productType || "other", listingType: item.listingType || "sale",
            condition: item.condition || "unknown", governorate: item.gov, district: item.dist,
            area: item.area, village: item.village, phone: item.phone,
            openingHours: item.hours || item.openingHours || "", website: item.website || "",
            description: item.desc, price: item.price, currency: item.currency || "YER",
            imageData: item.img || "", latitude: item.latitude ?? item.lat ?? null, longitude: item.longitude ?? item.lng ?? null, deadline: item.deadline || ""
          })
        });
        done++;
      } catch (_) { failed++; }
    }
    flash("تم إرسال " + done + " إدخالاً للمراجعة" + (failed ? "، وتعذر إرسال " + failed : "") + ".");
  }
  async function loadCategoryCounts() {
    try {
      const result = await api("/api/marketplace/counts");
      if (result && result.counts) window.dispatchEvent(new CustomEvent("dalilna:marketplace-counts",{detail:result.counts}));
      return result && result.counts || null;
    } catch (_) { return null; }
  }
  function bind() {
    fillSelect($("sharedDirectoryCategory"),CATS,tr("كل الأقسام"));
    fillSelect($("sharedDirectoryGovernorate"),GOVS.map(x=>[x,x]),tr("كل المحافظات"));
    fillSelect($("sharedSouqGovernorate"),GOVS.map(x=>[x,x]),tr("كل المحافظات"));
    const search = $("sharedDirectorySearch");
    if (search) search.addEventListener("click",loadHome);
    ["sharedDirectoryCategory","sharedDirectoryGovernorate"].forEach(id => {const el=$(id);if(el)el.addEventListener("change",loadHome);});
    ["sharedDirectoryQuery","sharedDirectoryDistrict"].forEach(id => {const el=$(id);if(el)el.addEventListener("keydown",e=>{if(e.key==="Enter")loadHome();});});
        const souqGov=$("sharedSouqGovernorate");if(souqGov)souqGov.addEventListener("change",loadSouq);
    const souqTabs=$("souqCategoryTabs");if(souqTabs)souqTabs.addEventListener("click",event=>{
      const button=event.target.closest("[data-group]");if(!button)return;
      souqTabs.querySelectorAll("[data-group]").forEach(item=>item.setAttribute("aria-pressed",item===button?"true":"false"));
      loadSouq();
    });
    const adminButton=$("sharedAdminReviewButton");if(adminButton)adminButton.addEventListener("click",loadAdminQueue);
    const migrateButton=$("sharedMigrateLocalButton");if(migrateButton)migrateButton.addEventListener("click",migrateLocal);
    loadHome();
    loadJobs();
    loadCategoryCounts();
    api("/api/marketplace/status").then(result => {
      const el=$("sharedDirectoryStatus");
      if(el&&!result.ready)el.textContent=tr("واجهة السوق المشترك جاهزة، وتنتظر تهيئة قاعدة PostgreSQL.");
    }).catch(()=>{});
    const refreshIntervalMs=6*60*60*1000;
    let lastSilentRefreshAt=Date.now();
    const refreshVisiblePanels=async(force=false)=>{
      if(document.hidden||(!force&&Date.now()-lastSilentRefreshAt<refreshIntervalMs))return;
      lastSilentRefreshAt=Date.now();
      const tasks=[loadHome(),loadCategoryCounts()];
      if($("vSouq")&&!$("vSouq").hidden)tasks.push(loadSouq());
      if($("vJobs")&&!$("vJobs").hidden)tasks.push(loadJobs());
      await Promise.allSettled(tasks);
    };
    window.addEventListener("focus",()=>refreshVisiblePanels(false));
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshVisiblePanels(false);});
    window.addEventListener("dalilna:languagechange",()=>{
      fillSelect($("sharedDirectoryCategory"),CATS,tr("كل الأقسام"));
      fillSelect($("sharedDirectoryGovernorate"),GOVS.map(x=>[x,x]),tr("كل المحافظات"));
      fillSelect($("sharedSouqGovernorate"),GOVS.map(x=>[x,x]),tr("كل المحافظات"));
      loadHome();
      if($("vSouq")&&!$("vSouq").hidden)loadSouq();
      if($("vJobs")&&!$("vJobs").hidden)loadJobs();
    });
    loadTimer=window.setInterval(()=>refreshVisiblePanels(false),refreshIntervalMs);
    document.addEventListener("click",event=>{if(event.target.closest("[data-go='jobs']"))window.setTimeout(loadJobs,120);if(event.target.closest("[data-go='souq']"))window.setTimeout(loadSouq,120);});
  }
  window.DalilnaShared = { submitListing, loadHome, loadSouq, loadJobs, loadAdminQueue, loadCategoryCounts };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",bind);
  else bind();
})();
