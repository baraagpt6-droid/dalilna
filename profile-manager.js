/* DALILNA_ROLE_PROFILE_MANAGER */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const GOVS = ["أمانة العاصمة","صنعاء","عدن","تعز","إب","الحديدة","ذمار","البيضاء","لحج","أبين","الضالع","مأرب","الجوف","صعدة","حجة","عمران","المحويت","ريمة","حضرموت","شبوة","المهرة","سقطرى"];
  const GOVS_EN = ["Capital Municipality","Sana'a","Aden","Taiz","Ibb","Al Hudaydah","Dhamar","Al Bayda","Lahij","Abyan","Al Dhale'e","Marib","Al Jawf","Sa'ada","Hajjah","Amran","Al Mahwit","Raymah","Hadramout","Shabwah","Al Mahrah","Socotra"];
  const CATEGORIES = [
    ["restaurants","مطاعم"],["pharmacies","صيدليات"],["electronics","إلكترونيات"],
    ["clothing","ملابس"],["groceries","مواد غذائية"],["services","خدمات"],
    ["real-estate","عقارات"],["other","أخرى"]
  ];
  const CATEGORY_EN = {restaurants:"Restaurants",pharmacies:"Pharmacies",electronics:"Electronics",clothing:"Clothing",groceries:"Groceries",services:"Services","real-estate":"Real estate",other:"Other"};
  const MARKET_CATEGORY = {
    food:"restaurants",cafe:"restaurants",pharmacy:"pharmacies",health:"pharmacies",
    elec:"electronics",telecom:"electronics",clothes:"clothing",beauty:"clothing",
    grocery:"groceries",market:"groceries",land:"real-estate",build:"services",
    craft:"services",transport:"services",utility:"services",delivery:"services",
    salon:"services",laundry:"services"
  };
  let afterSave = null, remoteRecords = [], remotePhone = "", syncBusy = false;
  const bridge = () => window.DALILNA_V3_BRIDGE;
  const profile = () => bridge()?.profile?.() || {};
  const english = () => String(window.DALILNA_LANGUAGE || document.documentElement.lang || "ar") === "en";
  const normalizePhone = value => {
    let result = String(value || "").replace(/\D/g,"");
    if (result.startsWith("00")) result = result.slice(2);
    if (result.startsWith("967") && result.length === 12) result = result.slice(3);
    if (result.startsWith("0") && result.length === 10) result = result.slice(1);
    return result;
  };
  const ready = value => !!(value && value.storeName && value.storeCategory && value.storeCity && normalizePhone(value.phone).length >= 9);
  const show = (id,visible) => { const node=$(id); if(node) node.hidden = !visible; };
  const write = (id,value) => { const node=$(id); if(node) node.textContent = String(value == null ? "" : value); };
  const govLabel = value => {
    const position = GOVS.indexOf(String(value || ""));
    return position >= 0 && english() ? GOVS_EN[position] : String(value || "");
  };
  const categoryLabel = value => {
    const entry = CATEGORIES.find(item => item[0] === value);
    return entry ? (english() ? CATEGORY_EN[value] : entry[1]) : (value || (english() ? "Not specified" : "غير محدد"));
  };
  function fillSelect(id,values,placeholder,selected,isCategory) {
    const select = $(id);
    if (!select) return;
    const key = id + "-" + (english() ? "en" : "ar");
    if (select.dataset.profileOptions !== key) {
      select.replaceChildren();
      const first = document.createElement("option");
      first.value = "";
      first.textContent = placeholder;
      select.appendChild(first);
      values.forEach((item,index) => {
        const value = Array.isArray(item) ? item[0] : item;
        const arabic = Array.isArray(item) ? item[1] : item;
        const option = document.createElement("option");
        option.value = value;
        option.textContent = isCategory ? (english() ? CATEGORY_EN[value] : arabic) : (english() ? GOVS_EN[index] : arabic);
        select.appendChild(option);
      });
      select.dataset.profileOptions = key;
    }
    select.value = selected || "";
  }
  function applyRole(selectedRole) {
    const merchant = selectedRole === "merchant";
    show("merchantSyncPanel",merchant);
    show("profileCustomerNameRow",!merchant);
    show("profileCustomerCityRow",!merchant);
    show("profileStoreNameRow",merchant);
    show("profileStoreCategoryRow",merchant);
    show("profileStoreCityRow",merchant);
    show("profileStoreAreaRow",merchant);
    write("profilePhoneLabel",merchant ? (english() ? "Store phone / WhatsApp" : "رقم جوال / واتساب المتجر") : (english() ? "Mobile number" : "رقم الجوال"));
    write("profileEditHint",merchant
      ? (english() ? "Store details are saved on this device. Public listing lookup does not verify phone ownership." : "تُحفظ بيانات المتجر على هذا الجهاز. جلب الإعلانات العامة لا يثبت ملكية رقم الجوال.")
      : (english() ? "Customer details are saved on this device." : "تُحفظ بيانات العميل على هذا الجهاز."));
    write("profileEditSave",merchant ? (english() ? "Save store" : "حفظ بيانات المتجر") : (english() ? "Save profile" : "حفظ بيانات العميل"));
    fillSelect("profileCustomerCityInput",GOVS,english()?"Choose a governorate / city":"اختر المحافظة / المدينة",profile().customerCity,false);
    fillSelect("profileStoreCityInput",GOVS,english()?"Choose a governorate":"اختر المحافظة",profile().storeCity,false);
    fillSelect("profileStoreCategoryInput",CATEGORIES,english()?"Choose a category":"اختر تصنيف النشاط",profile().storeCategory,true);
  }
  function open(options) {
    const p = profile(), merchant = p.activeRole === "merchant", form = $("profileEditForm");
    if (!form) return;
    afterSave = options && typeof options.afterSave === "function" ? options.afterSave : null;
    form.dataset.profileRole = merchant ? "merchant" : "customer";
    $("profileCustomerNameInput").value = p.customerName || "";
    $("profileCustomerCityInput").value = p.customerCity || "";
    $("profileStoreNameInput").value = p.storeName || "";
    $("profileStoreCategoryInput").value = p.storeCategory || "";
    $("profileStoreCityInput").value = p.storeCity || "";
    $("profileStoreAreaInput").value = p.storeArea || "";
    $("profilePhoneInput").value = p.phone || "";
    $("merchantSyncPhoneInput").value = p.phone || "";
    write("merchantSyncStatus",english()
      ? "Only publicly approved listings are searched. A phone number alone does not prove store ownership."
      : "يُبحث في الإعلانات المنشورة للعامة فقط. رقم الجوال وحده لا يثبت ملكية المتجر.");
    write("profileEditError","");
    applyRole(form.dataset.profileRole);
    form.hidden = false;
    show("profileEditToggle",false);
    const dialog = $("accountDlg");
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open","");
    }
    const target = merchant ? (ready(p) ? $("merchantSyncPhoneInput") : $("profileStoreNameInput")) : $("profileCustomerNameInput");
    if (target) window.setTimeout(() => target.focus(),80);
  }
  function renderPublicRecords() {
    const list = $("profileActivityList");
    if (!list) return;
    list.querySelectorAll(".profile-remote-records").forEach(item => item.remove());
    const searched = normalizePhone($("merchantSyncPhoneInput")?.value || profile().phone);
    if (profile().activeRole !== "merchant" || !remoteRecords.length || !remotePhone || searched !== remotePhone) return;
    const groups = [
      {title:english()?"Public shops found":"محلات عامة عُثر عليها",items:remoteRecords.filter(item => !["souq","land","jobs"].includes(item.category))},
      {title:english()?"Public marketplace adverts found":"إعلانات سوق عامة عُثر عليها",items:remoteRecords.filter(item => ["souq","land","jobs"].includes(item.category))}
    ];
    groups.forEach(group => {
      const section = document.createElement("section");
      section.className = "profile-activity-section profile-remote-records";
      const heading = document.createElement("b");
      heading.textContent = group.title;
      section.appendChild(heading);
      if (!group.items.length) {
        const empty = document.createElement("p");
        empty.className = "where";
        empty.textContent = english() ? "No public records in this group." : "لا توجد سجلات عامة في هذا القسم.";
        section.appendChild(empty);
      }
      group.items.slice(0,8).forEach(item => {
        const line = document.createElement("div");
        line.className = "profile-activity-item";
        line.textContent = [item.title || item.sellerName || (english()?"Listing":"إعلان"),[item.governorate,item.district,item.area].filter(Boolean).join("، ")].filter(Boolean).join(" · ");
        section.appendChild(line);
      });
      list.appendChild(section);
    });
  }
  function render() {
    const p = profile(), merchant = p.activeRole === "merchant";
    const admin = bridge()?.snapshot?.()?.role === "admin";
    const local = bridge()?.profileRecords?.() || {shops:[],marketplaceAds:[],otherAds:[]};
    const typedPhone = normalizePhone($("merchantSyncPhoneInput")?.value || "");
    const lookupMatches = merchant && remotePhone && (normalizePhone(p.phone) === remotePhone || typedPhone === remotePhone);
    const publicShops = lookupMatches ? remoteRecords.filter(item => !["souq","land","jobs"].includes(item.category)).length : 0;
    const publicAds = lookupMatches ? remoteRecords.filter(item => ["souq","land","jobs"].includes(item.category)).length : 0;
    show("profileMerchantCard",merchant && !admin);
    show("profileMerchantQuickActions",merchant && !admin && ready(p));
    show("profileShopsMetric",merchant && !admin);
    show("profileLocation",!merchant && !admin);
    show("profileDaysLeft",merchant && !admin);
    write("profileLocation",p.customerCity
      ? (english()?"Governorate: ":"المحافظة: ")+govLabel(p.customerCity)
      : (english()?"Governorate / city not set.":"المحافظة / المدينة غير محددة."));
    write("merchantStoreCategory",categoryLabel(p.storeCategory));
    write("merchantStoreCity",[govLabel(p.storeCity),p.storeArea].filter(Boolean).join("، ") || (english()?"Not specified":"غير محددة"));
    write("merchantStorePhone",p.phone || "—");
    const created = Number(p.merchantCreatedAt || bridge()?.snapshot?.()?.installDate || Date.now());
    const remaining = Math.max(0,Math.ceil((60*86400000-(Date.now()-created))/86400000));
    write("profileDaysLeft",english()?remaining+" free advertising days remaining":"متبقي "+remaining+" يوماً من الإعلان المجاني");
    write("profileEditToggle",merchant?(english()?"Edit / merchant access":"تعديل / دخول التاجر"):(english()?"Edit details":"تعديل البيانات"));
    write("profileAdsLabel",merchant?(english()?"My adverts":"إعلاناتي"):(english()?"My marketplace adverts":"إعلاناتي في السوق"));
    write("profileShopsLabel",english()?"My shops":"محلاتي");
    write("profileFavsLabel",english()?"Favourites":"المفضلة");
    const metrics = $("profileMetrics");
    if (metrics) metrics.dataset.role = merchant ? "merchant" : "customer";
    const adsCount = $("profileAdsCount"), shopsCount = $("profileShopsCount");
    if (adsCount) adsCount.textContent = String(merchant ? local.marketplaceAds.length + local.otherAds.length + publicAds : local.marketplaceAds.length);
    if (shopsCount) shopsCount.textContent = String(local.shops.length + publicShops);
    write("profileLocalNote",merchant
      ? (english()?"Store details are saved on this device. Public listing lookup does not confirm ownership or provide edit access." : "بيانات المتجر محفوظة على هذا الجهاز. جلب الإعلانات العامة لا يؤكد الملكية ولا يمنح صلاحية تعديلها.")
      : (english()?"Customer details are saved on this device." : "بيانات العميل محفوظة على هذا الجهاز."));
    renderPublicRecords();
  }
  function save(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = $("profileEditForm");
    const selectedRole = form.dataset.profileRole === "merchant" ? "merchant" : "customer";
    const current = profile(), phone = $("profilePhoneInput").value.trim();
    if (normalizePhone(phone).length < 9) {
      write("profileEditError",english()?"Enter a valid mobile number.":"أدخل رقم جوال صحيحاً.");
      $("profilePhoneInput").focus();
      return;
    }
    const patch = {
      customerName:current.customerName || "",customerCity:current.customerCity || "",
      storeName:current.storeName || "",storeCategory:current.storeCategory || "",
      storeCity:current.storeCity || "",storeArea:current.storeArea || "",
      merchantCreatedAt:current.merchantCreatedAt || 0,phone:phone,activeRole:selectedRole
    };
    if (selectedRole === "customer") {
      patch.customerName = $("profileCustomerNameInput").value.trim();
      patch.customerCity = $("profileCustomerCityInput").value;
      if (!patch.customerName) {
        write("profileEditError",english()?"Enter your full name.":"أدخل الاسم الكامل.");
        $("profileCustomerNameInput").focus();
        return;
      }
    } else {
      patch.storeName = $("profileStoreNameInput").value.trim();
      patch.storeCategory = $("profileStoreCategoryInput").value;
      patch.storeCity = $("profileStoreCityInput").value;
      patch.storeArea = $("profileStoreAreaInput").value.trim();
      if (!patch.storeName || !patch.storeCategory || !patch.storeCity) {
        write("profileEditError",english()?"Complete the store name, category and governorate.":"أكمل اسم المتجر والتصنيف والمحافظة.");
        if (!patch.storeName) $("profileStoreNameInput").focus();
        else if (!patch.storeCategory) $("profileStoreCategoryInput").focus();
        else $("profileStoreCityInput").focus();
        return;
      }
      patch.merchantCreatedAt = current.merchantCreatedAt || Date.now();
    }
    bridge()?.saveProfile?.(patch);
    form.hidden = true;
    show("profileEditToggle",true);
    $("merchantSyncPhoneInput").value = phone;
    render();
    const callback = afterSave;
    afterSave = null;
    const dialog = $("accountDlg");
    if (dialog && dialog.open && typeof dialog.close === "function") dialog.close();
    else if (dialog) dialog.removeAttribute("open");
    if (typeof callback === "function") window.setTimeout(callback,90);
  }
  function categoryFromRecord(record) {
    return MARKET_CATEGORY[String(record && record.category || "").toLowerCase()] || "other";
  }
  async function syncMerchant() {
    if (syncBusy) return;
    const phone = $("merchantSyncPhoneInput")?.value.trim() || "";
    if (normalizePhone(phone).length < 9) {
      write("merchantSyncStatus",english()?"Enter a valid store number first.":"أدخل رقم جوال صحيحاً أولاً.");
      $("merchantSyncPhoneInput")?.focus();
      return;
    }
    const button = $("merchantSyncButton");
    syncBusy = true;
    if (button) { button.disabled = true; button.textContent = english()?"Searching…":"جارٍ جلب البيانات…"; }
    write("merchantSyncStatus",english()?"Searching public listings for this number…":"جارٍ البحث في الإعلانات المنشورة المرتبطة بهذا الرقم…");
    try {
      const find = window.DalilnaShared?.findPublicSellerRecords;
      if (typeof find !== "function") throw new Error("NOT_READY");
      const result = await find(phone);
      remoteRecords = Array.isArray(result.items) ? result.items : [];
      remotePhone = normalizePhone(phone);
      if (!remoteRecords.length) {
        write("merchantSyncStatus",english()
          ? "No public listings were found for this number. Complete the store profile manually."
          : "لم نعثر على إعلانات منشورة للعامة مرتبطة بهذا الرقم. يمكنك إكمال بيانات المتجر يدوياً.");
        render();
        return;
      }
      const first = remoteRecords.find(item => item.sellerName) || remoteRecords[0];
      const current = profile();
      const values = {
        storeName:first.sellerName || current.storeName || "",
        storeCategory:categoryFromRecord(first),
        storeCity:first.governorate || current.storeCity || "",
        storeArea:[first.district,first.area,first.village].filter(Boolean).join("، ") || current.storeArea || ""
      };
      applyRole("merchant");
      $("profileStoreNameInput").value = values.storeName;
      $("profileStoreCategoryInput").value = values.storeCategory;
      $("profileStoreCityInput").value = values.storeCity;
      $("profileStoreAreaInput").value = values.storeArea;
      $("profilePhoneInput").value = phone;
      const partial = result.complete ? "" : (english()
        ? " Only the first " + result.scanned + " of " + result.total + " public records could be checked."
        : " تم فحص " + result.scanned + " من أصل " + result.total + " سجلاً عاماً فقط.");
      write("merchantSyncStatus",english()
        ? "Found " + remoteRecords.length + " public records for this number and filled the available fields. Review the details and save them. This does not verify ownership or grant editing access." + partial
        : "عثرنا على " + remoteRecords.length + " سجلاً عاماً لهذا الرقم وعبّأنا الحقول المتاحة. راجع البيانات واحفظها. هذا لا يثبت ملكية المتجر ولا يمنح صلاحية تعديل الإعلانات." + partial);
      render();
    } catch (_) {
      write("merchantSyncStatus",english()
        ? "We could not retrieve public listings right now. You can complete the store profile manually."
        : "تعذر جلب الإعلانات الآن. يمكنك إكمال بيانات المتجر يدوياً.");
    } finally {
      syncBusy = false;
      if (button) { button.disabled = false; button.textContent = english()?"Get my store details":"جلب بيانات متجري"; }
    }
  }
  function init() {
    const form = $("profileEditForm");
    if (!form) return;
    form.addEventListener("submit",save,true);
    $("merchantSyncButton")?.addEventListener("click",syncMerchant);
    $("profileEditToggle")?.addEventListener("click",event => {event.preventDefault();event.stopImmediatePropagation();open({full:true});},true);
    $("profileEditCancel")?.addEventListener("click",() => window.setTimeout(render,0));
    $("profileAddShopButton")?.addEventListener("click",() => $("addMerchantListingCard")?.click());
    $("profileAddAdButton")?.addEventListener("click",() => $("sqSell")?.click());
    $("v3RoleSwitcher")?.addEventListener("click",() => window.setTimeout(() => {
      const nextRole = profile().activeRole === "merchant" ? "merchant" : "customer";
      if (!form.hidden) {form.dataset.profileRole = nextRole;applyRole(nextRole);}
      render();
    },0),true);
    document.addEventListener("dalilna:favorite-change",render);
    document.addEventListener("dalilna:languagechange",render);
    const dialog = $("accountDlg");
    if (dialog) dialog.addEventListener("close",() => {if (!form.hidden) form.hidden = true;show("profileEditToggle",true);});
    render();
  }
  window.DalilnaProfileUI = {open:open,render:render,isReady:ready};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();