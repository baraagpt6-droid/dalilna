"use strict";
(() => {
  const API = window.DALILNA_API_BASE || "https://dalilna-live.onrender.com";
  const $ = id => document.getElementById(id);
  const isEnglish = () => String(window.DALILNA_LANGUAGE || document.documentElement.lang || "ar") === "en";
  const UI_EN = {
    "بقالات":"Groceries","مطاعم ومخابز":"Restaurants and bakeries","بوفيات وكافيهات":"Cafes","مدارس وتعليم":"Education","مستشفيات ومراكز":"Hospitals and health centres","صيدليات":"Pharmacies","جهات حكومية":"Government services","بنوك وصرافة":"Banks and exchange","وظائف":"Jobs","أراضٍ وعقارات":"Land and property","مواد بناء":"Building materials","قطع غيار":"Vehicle parts","حرفيون وصيانة":"Crafts and repair","نقل ومواصلات":"Transport","جوالات واتصالات":"Phones and telecom","مياه وغاز":"Water and gas","زراعة ومواشٍ":"Agriculture and livestock","مساجد":"Mosques","ذهب ومجوهرات":"Gold and jewellery","قاعات أعراس":"Wedding venues","فنادق وشقق":"Hotels and apartments","أسواق":"Markets","طاقة شمسية":"Solar energy","إلكترونيات":"Electronics","ملابس وأحذية":"Clothing and shoes","أدوات منزلية":"Home goods","مكتبات":"Books and stationery","عطور وتجميل":"Perfumes and beauty","توصيل":"Delivery","صالونات":"Salons","مغاسل":"Laundry","سوق البيع والشراء":"Marketplace","أخرى":"Other",
    "جوال":"Mobile phone","إكسسوارات جوال":"Phone accessories","ساعة":"Watch","كمبيوتر / لابتوب":"Computer / laptop","ملحقات كمبيوتر":"Computer accessories","جهاز لوحي":"Tablet","كاميرا":"Camera","سيارة":"Car","دراجة نارية":"Motorcycle","قطع غيار مركبات":"Vehicle parts","أرض":"Land","عقار":"Property","شقة":"Apartment","منزل":"House","أجهزة منزلية":"Home appliances","أثاث":"Furniture","ملابس":"Clothing","أحذية":"Shoes","ذهب ومجوهرات":"Gold and jewellery","عسل":"Honey","بن وقهوة":"Coffee","بهارات":"Spices","مواشٍ":"Livestock","منتجات زراعية":"Farm products","كتب":"Books","قرطاسية وأدوات مدرسية":"Stationery","عطور":"Perfume","مستحضرات تجميل":"Cosmetics","معدات طاقة شمسية":"Solar equipment","أدوات ومعدات":"Tools and equipment","مستلزمات منزلية":"Household goods","أدوات مطبخ":"Kitchenware","منتجات أطفال":"Baby products","ألعاب":"Toys","معدات رياضية":"Sports equipment","أعلاف":"Animal feed","بذور ومحاصيل":"Seeds and crops","معدات إنشاءات":"Construction equipment",
    "أمانة العاصمة":"Amanat Al Asimah","صنعاء":"Sana'a","عدن":"Aden","تعز":"Taiz","إب":"Ibb","الحديدة":"Al Hudaydah","ذمار":"Dhamar","البيضاء":"Al Bayda","لحج":"Lahj","أبين":"Abyan","الضالع":"Al Dhale'e","مأرب":"Marib","الجوف":"Al Jawf","صعدة":"Saada","حجة":"Hajjah","عمران":"Amran","المحويت":"Al Mahwit","ريمة":"Raymah","حضرموت":"Hadramout","شبوة":"Shabwah","المهرة":"Al Mahrah","سقطرى":"Socotra",
    "صورة الإعلان":"Listing image","لا توجد صورة مرفقة":"No image attached","إعلان":"Listing","البائع: ":"Seller: ","جديد":"New","مستعمل":"Used","للبيع":"For sale","للإيجار":"For rent","مطلوب":"Wanted","مقايضة":"Barter","مجاني":"Free","أوقات العمل: ":"Opening hours: ","الموقع الإلكتروني":"Website","آخر موعد للتقديم: ":"Application deadline: ","واتساب البائع":"Seller WhatsApp","اتصال":"Call","عرض الخريطة":"View map","موقع الإعلان":"Listing location","فتح الموقع في OpenStreetMap":"Open in OpenStreetMap","إعلان مجاني · مدة الصلاحية 60 يوماً":"Free listing · 60-day validity","إعلان مجاني · ينتهي ":"Free listing · expires ","مشاركة":"Share","★ مفضلة":"★ Favourite","☆ مفضلة":"☆ Favourite",
    "جارٍ تحميل الإعلانات المعتمدة من قاعدة البيانات المشتركة…":"Loading approved listings from the shared database…","خدمة البيانات المشتركة لم تُفعّل بعد. سيظهر المحتوى هنا بعد ربط قاعدة البيانات.":"The shared data service is not enabled yet. Listings will appear after the database is connected.","تعذر تحميل الإعلانات المشتركة. ":"Could not load shared listings. ","كل الأقسام":"All categories","كل المحافظات":"All governorates","ملاحظة للمراجعة (اختياري)":"Review note (optional)","موافقة ونشر":"Approve and publish","رفض":"Reject","لا توجد إعلانات تنتظر المراجعة.":"No listings are waiting for review.","طلبات تنتظر المراجعة: ":"Listings awaiting review: ","جارٍ تحميل طلبات المراجعة…":"Loading review requests…","تم اعتماد الإعلان ونشره للجميع.":"The listing was approved and published.","تم رفض الإعلان.":"The listing was rejected.","هذا الإعلان سبق إرساله للمراجعة.":"This listing has already been submitted for review.","تم استلام الإعلان. سيظهر لجميع المستخدمين بعد موافقة الإدارة.":"Your listing was received and will appear to users after admin approval.","حُفظ الإعلان على هذا الجهاز، لكن تعذرت مزامنته: ":"The listing was saved on this device, but could not be synced: "
  };
  const ui = (ar,en) => isEnglish() ? en : ar;
  const label = value => isEnglish() ? (UI_EN[value] || value) : value;

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
      option.textContent = label(pair[1]);
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
      img.alt = item.title || label("صورة الإعلان");
      img.loading = "lazy";
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "shared-listing-image-fallback no-image";
      placeholder.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span>'+label("لا توجد صورة مرفقة")+'</span>';
      card.appendChild(placeholder);
    }
    const title = document.createElement("h3");
    title.textContent = item.title || label("إعلان");
    card.appendChild(title);
    if (item.sellerName) {
      const seller = document.createElement("p");
      seller.className = "shared-listing-meta";
      seller.textContent = label("البائع: ") + item.sellerName;
      card.appendChild(seller);
    }
    const tags = document.createElement("div");
    tags.className = "shared-listing-tags";
    const category = CATS.find(x => x[0] === item.category);
    const product = PRODUCTS.find(x => x[0] === item.productType);
    const labels = [category ? label(category[1]) : item.category];
    if (item.category === "souq" || item.category === "land") labels.push(product ? label(product[1]) : ui("منتج آخر","Other product"));
    if (item.condition === "new") labels.push(label("جديد"));
    if (item.condition === "used") labels.push(label("مستعمل"));
    if (item.listingType === "sale") labels.push(label("للبيع"));
    if (item.listingType === "rent") labels.push(label("للإيجار"));
    if (item.listingType === "wanted") labels.push(label("مطلوب"));
    if (item.listingType === "barter") labels.push(label("مقايضة"));
    if (item.listingType === "free") labels.push(label("مجاني"));
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
      p.textContent = place;
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
      hours.textContent = label("أوقات العمل: ") + item.openingHours;
      card.appendChild(hours);
    }
    if (item.website) {
      const website = document.createElement("a");
      website.href = item.website;
      website.target = "_blank";
      website.rel = "noopener noreferrer";
      website.textContent = label("الموقع الإلكتروني");
      card.appendChild(website);
    }
    if (item.category === "jobs" && item.deadline) {
      const deadline = document.createElement("p");
      deadline.className = "shared-listing-meta";
      deadline.textContent = label("آخر موعد للتقديم: ") + item.deadline;
      card.appendChild(deadline);
    }
    const actions = document.createElement("div");
    actions.className = "shared-listing-actions";
    if (item.phone) {
      const phoneDigits = String(item.phone).replace(/[^0-9]/g, "");
      if (phoneDigits.length >= 9 && phoneDigits.length <= 15) {
        const wa = document.createElement("a");
        wa.href = "https://wa.me/" + phoneDigits + "?text=" + encodeURIComponent("مرحباً، وجدت إعلانكم في دليلنا وأريد الاستفسار.");
        wa.target = "_blank"; wa.rel = "noopener noreferrer"; wa.textContent = label("واتساب البائع"); actions.appendChild(wa);
      }
      const tel = document.createElement("a");
      tel.href = "tel:" + String(item.phone).replace(/[^0-9+]/g, "");
      tel.textContent = label("اتصال"); actions.appendChild(tel);
    }
    let mapElement = null;
    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      const mapButton = document.createElement("button");
      mapButton.type = "button"; mapButton.dataset.mapToggle = "1";
      mapButton.dataset.lat = String(item.latitude); mapButton.dataset.lon = String(item.longitude);
      mapButton.dataset.title = item.title || label("موقع الإعلان"); mapButton.textContent = label("عرض الخريطة");
      actions.appendChild(mapButton);
      mapElement = document.createElement("div"); mapElement.className = "dalilna-map"; mapElement.hidden = true;
    } else if (place) {
      const map = document.createElement("a");
      map.href = "https://www.openstreetmap.org/search?query=" + encodeURIComponent([item.title,place,"اليمن"].join(" "));
      map.target = "_blank"; map.rel = "noopener noreferrer"; map.textContent = label("فتح الموقع في OpenStreetMap"); actions.appendChild(map);
    }
    if (item.category === "souq" || item.category === "land") {
      const expiry = document.createElement("p"); expiry.className = "shared-listing-expiry";
      const expiryDate = item.expiresAt ? new Date(item.expiresAt) : null;
      expiry.textContent = !expiryDate || Number.isNaN(expiryDate.getTime()) ? label("إعلان مجاني · مدة الصلاحية 60 يوماً") : label("إعلان مجاني · ينتهي ") + expiryDate.toLocaleDateString(isEnglish()?"en":"ar");
      card.appendChild(expiry);
    }
    if (item.category === "souq" || item.category === "land") {
      const share = document.createElement("button"); share.type = "button"; share.dataset.shareId = item.id; share.textContent = label("مشاركة"); share._item = item; actions.appendChild(share);
      let favs = []; try { favs = JSON.parse(localStorage.getItem("dalilna-marketplace-favs-v1") || "[]"); } catch (_) {}
      const favorite = document.createElement("button"); favorite.type = "button"; favorite.dataset.favId = item.id;
      favorite.setAttribute("aria-pressed",favs.includes(item.id)?"true":"false"); favorite.className = favs.includes(item.id)?"is-favorite":""; favorite.textContent = favs.includes(item.id)?label("★ مفضلة"):label("☆ مفضلة"); actions.appendChild(favorite);
    }
    card.appendChild(actions);
    if (mapElement) card.appendChild(mapElement);
    return card;
  }
  async function loadList(filters, statusId, listId) {
    const status = $(statusId), list = $(listId);
    if (!list || !status) return;
    status.textContent = label("جارٍ تحميل الإعلانات المعتمدة من قاعدة البيانات المشتركة…");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key,value]) => { if (value && value !== "all") params.set(key,value); });
    params.set("limit","12");
    params.set("includeImages","1");
    try {
      const result = await api("/api/marketplace/listings?" + params.toString());
      list.replaceChildren();
      (result.items || []).forEach(item => list.appendChild(makeCard(item)));
      status.textContent = result.count
        ? ui("يعرض ","Showing ") + result.items.length + ui(" من "," of ") + result.count + ui(" إعلاناً منشوراً · آخر تحديث "," published listings · Last update ") + new Date(result.fetchedAt).toLocaleTimeString(isEnglish()?"en":"ar")
        : "";
      return result;
    } catch (e) {
      list.replaceChildren();
      status.textContent = e.status === 503
        ? "خدمة البيانات المشتركة لم تُفعّل بعد. سيظهر المحتوى هنا بعد ربط قاعدة البيانات."
        : "تعذر تحميل الإعلانات المشتركة. " + e.message;
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
      flash(label(result.duplicate ? "هذا الإعلان سبق إرساله للمراجعة." : "تم استلام الإعلان. سيظهر لجميع المستخدمين بعد موافقة الإدارة."));
    } catch (e) {
      flash(label("حُفظ الإعلان على هذا الجهاز، لكن تعذرت مزامنته: ") + e.message);
    }
  }
  async function review(id, decision, note) {
    try {
      await api("/api/marketplace/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken },
        body: JSON.stringify({ id, decision, note })
      });
      flash(label(decision === "approve" ? "تم اعتماد الإعلان ونشره للجميع." : "تم رفض الإعلان."));
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
    status.textContent = label("جارٍ تحميل طلبات المراجعة…");
    box.replaceChildren();
    try {
      const result = await api("/api/marketplace/admin/pending", {
        headers: { Authorization: "Bearer " + adminToken }
      });
      if (!result.items || !result.items.length) {
        status.textContent = label("لا توجد إعلانات تنتظر المراجعة.");
        return;
      }
      status.textContent = label("طلبات تنتظر المراجعة: ") + result.items.length;
      result.items.forEach(item => {
        const row = makeCard(item);
        row.classList.add("shared-admin-item");
        const note = document.createElement("textarea");
        note.maxLength = 500;
        note.placeholder = label("ملاحظة للمراجعة (اختياري)");
        const actions = document.createElement("div");
        actions.className = "shared-listing-actions";
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "shared-approve";
        approve.textContent = label("موافقة ونشر");
        approve.addEventListener("click", () => review(item.id,"approve",note.value));
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "shared-reject";
        reject.textContent = label("رفض");
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
    fillSelect($("sharedDirectoryCategory"),CATS,label("كل الأقسام"));
    fillSelect($("sharedDirectoryGovernorate"),GOVS.map(x=>[x,x]),label("كل المحافظات"));
    fillSelect($("sharedSouqGovernorate"),GOVS.map(x=>[x,x]),label("كل المحافظات"));
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
    window.addEventListener("dalilna:languagechange",()=>{
      fillSelect($("sharedDirectoryCategory"),CATS,label("كل الأقسام"));
      fillSelect($("sharedDirectoryGovernorate"),GOVS.map(x=>[x,x]),label("كل المحافظات"));
      fillSelect($("sharedSouqGovernorate"),GOVS.map(x=>[x,x]),label("كل المحافظات"));
      loadHome();loadSouq();loadJobs();
    });
    loadHome();
    loadJobs();
    loadCategoryCounts();
    api("/api/marketplace/status").then(result => {
      const el=$("sharedDirectoryStatus");
      if(el&&!result.ready)el.textContent="واجهة السوق المشترك جاهزة، وتنتظر تهيئة قاعدة PostgreSQL.";
    }).catch(()=>{});
    window.addEventListener("focus",()=>{loadHome();if($("vSouq")&&!$("vSouq").hidden)loadSouq();if($("vJobs")&&!$("vJobs").hidden)loadJobs();});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden){loadHome();if($("vSouq")&&!$("vSouq").hidden)loadSouq();if($("vJobs")&&!$("vJobs").hidden)loadJobs();}});
    loadTimer=window.setInterval(()=>{if(document.hidden)return;loadHome();if($("vSouq")&&!$("vSouq").hidden)loadSouq();if($("vJobs")&&!$("vJobs").hidden)loadJobs();},120000);
    document.addEventListener("click",event=>{if(event.target.closest("[data-go='jobs']"))window.setTimeout(loadJobs,120);if(event.target.closest("[data-go='souq']"))window.setTimeout(loadSouq,120);});
  }
  window.DalilnaShared = { submitListing, loadHome, loadSouq, loadJobs, loadAdminQueue, loadCategoryCounts };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",bind);
  else bind();
})();
