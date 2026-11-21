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
    ["honey","عسل"],["coffee","بن وقهوة"],["spices","بهارات"],["food","مواد غذائية"],
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
      option.textContent = pair[1];
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
      img.alt = item.title || "صورة الإعلان";
      img.loading = "lazy";
      card.appendChild(img);
    }
    const title = document.createElement("h3");
    title.textContent = item.title || "إعلان";
    card.appendChild(title);
    const tags = document.createElement("div");
    tags.className = "shared-listing-tags";
    const category = CATS.find(x => x[0] === item.category);
    const product = PRODUCTS.find(x => x[0] === item.productType);
    const labels = [category ? category[1] : item.category];
    if (item.category === "souq" || item.category === "land") labels.push(product ? product[1] : "منتج آخر");
    if (item.condition === "new") labels.push("جديد");
    if (item.condition === "used") labels.push("مستعمل");
    if (item.listingType === "sale") labels.push("للبيع");
    if (item.listingType === "rent") labels.push("للإيجار");
    if (item.listingType === "wanted") labels.push("مطلوب");
    if (item.listingType === "barter") labels.push("مقايضة");
    if (item.listingType === "free") labels.push("مجاني");
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
      hours.textContent = "أوقات العمل: " + item.openingHours;
      card.appendChild(hours);
    }
    if (item.website) {
      const website = document.createElement("a");
      website.href = item.website;
      website.target = "_blank";
      website.rel = "noopener noreferrer";
      website.textContent = "الموقع الإلكتروني";
      card.appendChild(website);
    }
    if (item.category === "jobs" && item.deadline) {
      const deadline = document.createElement("p");
      deadline.className = "shared-listing-meta";
      deadline.textContent = "آخر موعد للتقديم: " + item.deadline;
      card.appendChild(deadline);
    }
    const actions = document.createElement("div");
    actions.className = "shared-listing-actions";
    if (item.phone) {
      const phoneDigits = String(item.phone).replace(/[^0-9]/g, "");
      if (phoneDigits.length >= 9 && phoneDigits.length <= 15) {
        const wa = document.createElement("a");
        wa.href = "https://wa.me/" + phoneDigits + "?text=" + encodeURIComponent("مرحباً، وجدت إعلانكم في دليلنا وأريد الاستفسار.");
        wa.target = "_blank"; wa.rel = "noopener noreferrer"; wa.textContent = "واتساب البائع"; actions.appendChild(wa);
      }
      const tel = document.createElement("a");
      tel.href = "tel:" + String(item.phone).replace(/[^0-9+]/g, "");
      tel.textContent = "اتصال"; actions.appendChild(tel);
    }
    let mapElement = null;
    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      const mapButton = document.createElement("button");
      mapButton.type = "button"; mapButton.dataset.mapToggle = "1";
      mapButton.dataset.lat = String(item.latitude); mapButton.dataset.lon = String(item.longitude);
      mapButton.dataset.title = item.title || "موقع الإعلان"; mapButton.textContent = "عرض الخريطة";
      actions.appendChild(mapButton);
      mapElement = document.createElement("div"); mapElement.className = "dalilna-map"; mapElement.hidden = true;
    } else if (place) {
      const map = document.createElement("a");
      map.href = "https://www.openstreetmap.org/search?query=" + encodeURIComponent([item.title,place,"اليمن"].join(" "));
      map.target = "_blank"; map.rel = "noopener noreferrer"; map.textContent = "فتح الموقع في OpenStreetMap"; actions.appendChild(map);
    }
    if (item.expiresAt) {
      const expiry = document.createElement("p"); expiry.className = "shared-listing-expiry";
      const expiryDate = new Date(item.expiresAt);
      expiry.textContent = Number.isNaN(expiryDate.getTime()) ? "إعلان مجاني لمدة 60 يوماً" : "إعلان مجاني · ينتهي " + expiryDate.toLocaleDateString("ar");
      card.appendChild(expiry);
    }
    if (item.category === "souq" || item.category === "land") {
      const share = document.createElement("button"); share.type = "button"; share.dataset.shareId = item.id; share.textContent = "مشاركة"; share._item = item; actions.appendChild(share);
      let favs = []; try { favs = JSON.parse(localStorage.getItem("dalilna-marketplace-favs-v1") || "[]"); } catch (_) {}
      const favorite = document.createElement("button"); favorite.type = "button"; favorite.dataset.favId = item.id;
      favorite.setAttribute("aria-pressed",favs.includes(item.id)?"true":"false"); favorite.className = favs.includes(item.id)?"is-favorite":""; favorite.textContent = favs.includes(item.id)?"★ مفضلة":"☆ مفضلة"; actions.appendChild(favorite);
    }
    card.appendChild(actions);
    if (mapElement) card.appendChild(mapElement);
    return card;
  }
  async function loadList(filters, statusId, listId) {
    const status = $(statusId), list = $(listId);
    if (!list || !status) return;
    status.textContent = "جارٍ تحميل الإعلانات المعتمدة من قاعدة البيانات المشتركة…";
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key,value]) => { if (value && value !== "all") params.set(key,value); });
    params.set("limit","12");
    params.set("includeImages","1");
    try {
      const result = await api("/api/marketplace/listings?" + params.toString());
      list.replaceChildren();
      (result.items || []).forEach(item => list.appendChild(makeCard(item)));
      status.textContent = result.count
        ? "يعرض " + result.items.length + " من " + result.count + " إعلاناً منشوراً · آخر تحديث " + new Date(result.fetchedAt).toLocaleTimeString("ar")
        : "لا توجد إعلانات معتمدة تطابق البحث حالياً.";
    } catch (e) {
      list.replaceChildren();
      status.textContent = e.status === 503
        ? "خدمة البيانات المشتركة لم تُفعّل بعد. سيظهر المحتوى هنا بعد ربط قاعدة البيانات."
        : "تعذر تحميل الإعلانات المشتركة. " + e.message;
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
  function loadSouq() {
    const selectedType = document.querySelector("#souqTransactionTabs [aria-pressed=true]");
    const selectedGroup = document.querySelector("#souqCategoryTabs [aria-pressed=true]");
    return loadList({
      category: "marketplace",
      productType: $("sharedSouqType") && $("sharedSouqType").value,
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
    fillSelect($("sharedDirectoryCategory"),CATS,"كل الأقسام");
    fillSelect($("sharedDirectoryGovernorate"),GOVS.map(x=>[x,x]),"كل المحافظات");
    fillSelect($("sharedSouqType"),PRODUCTS,"كل أنواع المنتجات");
    fillSelect($("sharedSouqGovernorate"),GOVS.map(x=>[x,x]),"كل المحافظات");
    const search = $("sharedDirectorySearch");
    if (search) search.addEventListener("click",loadHome);
    ["sharedDirectoryCategory","sharedDirectoryGovernorate"].forEach(id => {const el=$(id);if(el)el.addEventListener("change",loadHome);});
    ["sharedDirectoryQuery","sharedDirectoryDistrict"].forEach(id => {const el=$(id);if(el)el.addEventListener("keydown",e=>{if(e.key==="Enter")loadHome();});});
    const homeRefresh=$("sharedDirectoryRefresh");if(homeRefresh)homeRefresh.addEventListener("click",loadHome);
    const souqRefresh=$("sharedSouqRefresh");if(souqRefresh)souqRefresh.addEventListener("click",loadSouq);
    const jobsRefresh=$("sharedJobsRefresh");if(jobsRefresh)jobsRefresh.addEventListener("click",loadJobs);
    const souqType=$("sharedSouqType");if(souqType)souqType.addEventListener("change",loadSouq);
    const souqGov=$("sharedSouqGovernorate");if(souqGov)souqGov.addEventListener("change",loadSouq);
    const adminButton=$("sharedAdminReviewButton");if(adminButton)adminButton.addEventListener("click",loadAdminQueue);
    const migrateButton=$("sharedMigrateLocalButton");if(migrateButton)migrateButton.addEventListener("click",migrateLocal);
    loadHome();
    loadSouq();
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
